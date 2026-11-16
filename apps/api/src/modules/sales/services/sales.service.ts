import { Injectable } from '@nestjs/common';
import {
  addMoney,
  allocateMoney,
  type cancelHeldSchema,
  type checkoutSchema,
  compareMoney,
  fromMinor,
  type handoverSchema,
  multiplyMoney,
  normalizeSearch,
  type Page,
  type PaymentReceipt,
  type PaymentState,
  type ReceiptData,
  type receivePaymentSchema,
  roleCan,
  type saleListQuerySchema,
  type SaleSummary,
  type SaleView,
  toMinor,
  type Translatable,
} from '@organza/shared';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  customers,
  itemOptionValues,
  items,
  journalLines,
  optionTypes,
  optionValues,
  paymentAllocations,
  products,
  saleHandovers,
  saleLines,
  saleReturns,
  sales,
  shifts,
  users,
} from '../../../database/schema/index.js';
import { type Database, type Executor, type Transaction } from '../../../database/unit-of-work.js';
import {
  credit,
  debit,
  LedgerService,
  type PostingLine,
} from '../../ledger/services/ledger.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { StockService } from '../../stock/services/stock.service.js';
import { SALES_ERRORS } from '../constants.js';
import { CustomersService } from './customers.service.js';
import { type PricedPayment, PaymentsService } from './payments.service.js';
import { ShiftsService } from './shifts.service.js';

type Sale = typeof sales.$inferSelect;
type Line = typeof saleLines.$inferSelect;
const neg = (amount: string) => fromMinor(-toMinor(amount));
const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);
const DUPLICATE_WINDOW_MS = 60_000;

/**
 * The sale document and everything that moves money on it: checkout (counter, debt and held),
 * repayments, hand-over of held goods and cancelling a held sale. Every method runs in one
 * transaction with its audit row and is idempotent on the client's key.
 *
 * Ledger shape: receivable and deposit lines carry the customer as party and the sale id as
 * dimension, so what is owed on each sale and what was paid towards it are read back from the
 * ledger itself.
 */
@Injectable()
export class SalesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly stock: StockService,
    private readonly settings: SettingsService,
    private readonly currencies: CurrenciesService,
    private readonly customers: CustomersService,
    private readonly payments: PaymentsService,
    private readonly shifts: ShiftsService,
  ) {}

  // ------------------------------------------------------------------ checkout

  async checkout(actor: Actor, input: z.output<typeof checkoutSchema>): Promise<SaleView> {
    const { result, replayed } = await this.idempotency.run(
      'sales.checkout',
      input.idempotencyKey,
      actor.id,
      input,
      (tx) => this.checkoutWithin(tx, actor, input),
    );
    const view = await this.get(result.id);
    return replayed ? { ...view, replayed: true } : view;
  }

  /**
   * The checkout itself, inside the caller's transaction. `credit` is value the customer already
   * has towards this sale from an exchange: it pays the sale before any tender, and the caller
   * moves it over (`credited` in the result).
   */
  async checkoutWithin(
    tx: Transaction,
    actor: Actor,
    input: z.output<typeof checkoutSchema>,
    opts: { credit?: string } = {},
  ) {
    const shopSettings = await this.settings.get(tx);
    const defaultCurrency = await this.currencies.defaultCode(tx);
    const today = await this.ledger.today(tx);

    const needsShift =
      input.source === 'COUNTER' || input.payments.some((p) => p.method === 'CASH');
    if (needsShift && !input.shiftId)
      throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
    const shift = input.shiftId ? await this.shifts.requireOpen(tx, input.shiftId) : null;
    const customer = input.customerId ? await this.customers.lock(tx, input.customerId) : null;

    // Prices and snapshots come from the server; the client's price only detects a change.
    const catalogue = await this.catalogueRows(
      tx,
      input.lines.map((l) => l.itemId),
    );
    const notSellable = input.lines
      .filter((l) => !catalogue.get(l.itemId)?.sellable)
      .map((l) => l.itemId);
    if (notSellable.length)
      throw conflict(SALES_ERRORS.ITEM_NOT_SELLABLE, 'Some items cannot be sold', {
        items: notSellable,
      });
    const changed = input.lines
      .filter((l) => compareMoney(catalogue.get(l.itemId)!.price, l.unitPrice) !== 0)
      .map((l) => ({ itemId: l.itemId, price: catalogue.get(l.itemId)!.price }));
    if (changed.length)
      throw conflict(SALES_ERRORS.PRICE_CHANGED, 'Prices changed since the cart was opened', {
        items: changed,
      });

    if (input.lines.some((l) => l.giveaway) && !roleCan(actor.role, 'sales.giveaway'))
      throw forbidden(SALES_ERRORS.GIVEAWAY_NEEDS_MANAGER, 'Giveaways need a manager');
    if (input.lines.some((l) => l.giveaway) && input.mode === 'HELD')
      throw badRequest(SALES_ERRORS.GIVEAWAY_NOT_HELD, 'Giveaways are handed over at once');
    const priced = input.lines.map((l) => {
      const price = l.giveaway ? '0.00' : catalogue.get(l.itemId)!.price;
      if (l.giveaway && compareMoney(l.discount, 0) > 0)
        throw badRequest(SALES_ERRORS.DISCOUNT_TOO_LARGE, 'A giveaway has no discount', {
          itemId: l.itemId,
        });
      const gross = multiplyMoney(price, l.quantity);
      if (compareMoney(l.discount, gross) > 0)
        throw badRequest(SALES_ERRORS.DISCOUNT_TOO_LARGE, 'Discount above the line value', {
          itemId: l.itemId,
        });
      return { ...l, price, gross, net: addMoney(gross, neg(l.discount)) };
    });
    const netTotal = addMoney(...priced.map((p) => p.net));
    if (compareMoney(input.cartDiscount, netTotal) > 0)
      throw badRequest(SALES_ERRORS.DISCOUNT_TOO_LARGE, 'Discount above the cart value');
    const shares = allocateMoney(
      input.cartDiscount,
      priced.map((p) => toMinor(p.net)),
    );
    const lines = priced.map((p, i) => {
      const discount = addMoney(p.discount, shares[i] ?? '0');
      return { ...p, discount, lineTotal: addMoney(p.gross, neg(discount)) };
    });
    const subtotal = addMoney(...lines.map((l) => l.gross));
    const discountTotal = addMoney(...lines.map((l) => l.discount));
    const total = addMoney(subtotal, neg(discountTotal));
    if (
      toMinor(discountTotal) * 100 > toMinor(subtotal) * shopSettings.employeeMaxDiscountPercent &&
      !roleCan(actor.role, 'sales.bigDiscount')
    )
      throw forbidden(SALES_ERRORS.DISCOUNT_NEEDS_MANAGER, 'This discount needs a manager');

    if (!input.confirmDuplicate) await this.assertNotDuplicate(tx, actor, total, input.lines);

    const credited = opts.credit ? minMoney(opts.credit, total) : '0.00';
    const tendered: PricedPayment[] = [];
    for (const p of input.payments)
      tendered.push(await this.payments.price(tx, p, defaultCurrency));
    const tenderedTotal = addMoney('0', ...tendered.map((p) => p.amountDefault));
    const excess = addMoney(tenderedTotal, credited, neg(total));
    let change = '0.00';
    let kept = '0.00';
    if (compareMoney(excess, 0) > 0) {
      if (input.overpayment === 'CREDIT') kept = excess;
      else {
        const cash = addMoney(
          '0',
          ...tendered.filter((p) => p.method === 'CASH').map((p) => p.amountDefault),
        );
        if (compareMoney(cash, excess) < 0)
          throw badRequest(SALES_ERRORS.OVERPAID_NON_CASH, 'Only cash can be over-tendered');
        change = excess;
      }
    }
    const owed = compareMoney(excess, 0) < 0 ? neg(excess) : '0.00';
    const storeCredit = addMoney(
      '0',
      ...tendered.filter((p) => p.method === 'STORE_CREDIT').map((p) => p.amountDefault),
    );
    const needsCustomer =
      input.mode === 'HELD' ||
      compareMoney(owed, 0) > 0 ||
      compareMoney(kept, 0) > 0 ||
      compareMoney(storeCredit, 0) > 0;
    if (needsCustomer && !customer)
      throw badRequest(
        SALES_ERRORS.CUSTOMER_REQUIRED,
        'Debt, held goods and store credit need a customer',
      );
    if (customer && compareMoney(storeCredit, 0) > 0) {
      const balance = (await this.customers.balances(tx, [customer.id])).get(customer.id)!;
      if (compareMoney(storeCredit, balance.credit) > 0)
        throw conflict(SALES_ERRORS.CREDIT_INSUFFICIENT, 'Not enough store credit', {
          credit: balance.credit,
        });
    }

    const number = await this.documents.next(tx, 'S');
    const [sale] = await tx
      .insert(sales)
      .values({
        number,
        source: input.source,
        fulfilmentMode: input.mode,
        fulfilmentStatus: input.mode === 'HELD' ? 'HELD' : 'FULFILLED',
        customerId: customer?.id ?? null,
        shiftId: shift?.id ?? null,
        businessDate: today,
        subtotal,
        discountTotal,
        total,
        giftReceipt: input.giftReceipt,
        note: input.note ?? null,
        createdBy: actor.id,
      })
      .returning();
    const saleId = sale!.id;
    const party = customer ? { partyType: 'CUSTOMER' as const, partyId: customer.id } : {};
    const onSale = { ...party, dimension: saleId };

    // Stock: taken goods leave now (cost of goods posted by the stock service); held goods are
    // reserved and leave at hand-over.
    const costs = new Map<string, { unitCost: string; costUnknown: boolean }>();
    if (input.mode === 'TAKEN') {
      const applied = await this.stock.apply(tx, {
        sourceType: 'sale',
        sourceId: saleId,
        event: 'SALE',
        actorId: actor.id,
        entryDate: today,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: -l.quantity,
          reason: l.giveaway ? 'GIFT' : 'SALE',
          counterAccount: l.giveaway ? 'PROMOTIONS' : 'COGS',
        })),
      });
      for (const m of applied.movements)
        costs.set(m.itemId, { unitCost: m.unitCost, costUnknown: m.costUnknown });
    } else {
      await this.stock.reserve(
        tx,
        lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
      );
    }

    await tx.insert(saleLines).values(
      lines.map((l, i) => {
        const c = catalogue.get(l.itemId)!;
        return {
          saleId,
          position: i + 1,
          itemId: l.itemId,
          productId: c.productId,
          name: c.name,
          variantLabel: c.variantLabel,
          sku: c.sku,
          quantity: l.quantity,
          unitPrice: l.price,
          discount: l.discount,
          lineTotal: l.lineTotal,
          unitCost: costs.get(l.itemId)?.unitCost ?? null,
          costUnknown: costs.get(l.itemId)?.costUnknown ?? false,
          giveaway: l.giveaway,
        };
      }),
    );

    if (input.mode === 'TAKEN') {
      await this.ledger.post(tx, {
        sourceType: 'sale',
        sourceId: saleId,
        event: 'SALE_COMPLETED',
        createdBy: actor.id,
        entryDate: today,
        lines: [
          debit('CUSTOMER_RECEIVABLES', total, onSale),
          debit('DISCOUNTS_GIVEN', discountTotal),
          credit('SALES_REVENUE', subtotal),
        ],
      });
    }

    // Payments in the order given; each pays the sale until it is covered. A held sale's
    // payments are deposits (customer credit for that sale) until hand-over.
    let due = addMoney(total, neg(credited));
    const saleAccount = input.mode === 'TAKEN' ? 'CUSTOMER_RECEIVABLES' : 'CUSTOMER_CREDIT';
    for (const p of tendered) {
      const allocated = minMoney(p.amountDefault, due);
      due = addMoney(due, neg(allocated));
      const rest = addMoney(p.amountDefault, neg(allocated));
      const counter: PostingLine[] = [credit(saleAccount, allocated, onSale)];
      if (compareMoney(rest, 0) > 0)
        counter.push(
          input.overpayment === 'CREDIT'
            ? credit('CUSTOMER_CREDIT', rest, party)
            : credit('CUSTOMER_RECEIVABLES', rest, onSale),
        );
      const row = await this.payments.record(tx, {
        ...p,
        direction: 'IN',
        purpose: 'SALE',
        customerId: customer?.id ?? null,
        shiftId: shift?.id ?? null,
        saleId,
        takenBy: actor.id,
        businessDate: today,
        counter,
      });
      await this.payments.allocate(tx, [
        { paymentId: row.id, saleId, amount: allocated, createdBy: actor.id },
      ]);
    }
    if (compareMoney(change, 0) > 0) {
      await this.payments.record(tx, {
        method: 'CASH',
        currency: defaultCurrency,
        amount: change,
        rate: '1',
        amountDefault: change,
        direction: 'OUT',
        purpose: 'CHANGE',
        customerId: customer?.id ?? null,
        shiftId: shift!.id,
        saleId,
        takenBy: actor.id,
        businessDate: today,
        counter: [debit('CUSTOMER_RECEIVABLES', change, onSale)],
      });
    }

    await this.audit.record(tx, {
      userId: actor.id,
      action: 'SALE_CREATE',
      entity: 'sale',
      entityId: saleId,
      newValue: {
        number,
        mode: input.mode,
        total,
        discountTotal,
        tendered: tenderedTotal,
        change,
        kept,
        owed,
        credited,
        giftReceipt: input.giftReceipt,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          price: l.price,
          discount: l.discount,
          giveaway: l.giveaway,
        })),
      },
    });
    return { id: saleId, number, credited, total };
  }

  /** Same cashier, same cart, same total within a minute: ask before saving it again. */
  private async assertNotDuplicate(
    tx: Transaction,
    actor: Actor,
    total: string,
    lines: { itemId: string; quantity: number }[],
  ) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
    const recent = await tx
      .select({ id: sales.id, number: sales.number })
      .from(sales)
      .where(
        and(eq(sales.createdBy, actor.id), gte(sales.createdAt, since), eq(sales.total, total)),
      );
    if (!recent.length) return;
    const signature = (rows: { itemId: string | null; quantity: number }[]) =>
      rows
        .map((r) => `${r.itemId}:${r.quantity}`)
        .sort()
        .join(',');
    const mine = signature(lines);
    for (const r of recent) {
      const their = await tx
        .select({ itemId: saleLines.itemId, quantity: saleLines.quantity })
        .from(saleLines)
        .where(eq(saleLines.saleId, r.id));
      if (signature(their) === mine)
        throw conflict(SALES_ERRORS.POSSIBLE_DUPLICATE, 'The same cart was just sold', {
          saleId: r.id,
          number: r.number,
        });
    }
  }

  /** Server-side price, sellability and receipt snapshots for each item. */
  private async catalogueRows(executor: Executor, itemIds: string[]) {
    const ids = [...new Set(itemIds)];
    const rows = await executor
      .select({
        itemId: items.id,
        sku: items.sku,
        number: items.number,
        itemPrice: items.price,
        itemActive: items.isActive,
        itemArchived: items.archivedAt,
        productId: products.id,
        productType: products.type,
        productPrice: products.price,
        status: products.status,
        name: products.name,
      })
      .from(items)
      .innerJoin(products, eq(products.id, items.productId))
      .where(inArray(items.id, ids));
    const options = ids.length
      ? await executor
          .select({ itemId: itemOptionValues.itemId, value: optionValues.value })
          .from(itemOptionValues)
          .innerJoin(optionValues, eq(optionValues.id, itemOptionValues.valueId))
          .innerJoin(optionTypes, eq(optionTypes.id, optionValues.typeId))
          .where(inArray(itemOptionValues.itemId, ids))
          .orderBy(asc(optionTypes.sortOrder), asc(optionValues.sortOrder))
      : [];
    const labels = new Map<string, Translatable[]>();
    for (const o of options) labels.set(o.itemId, [...(labels.get(o.itemId) ?? []), o.value]);
    const join = (values: Translatable[]): Translatable => {
      const pick = (lang: keyof Translatable) =>
        values.map((v) => v[lang] || v.ar || v.en || v.he || '').join(' · ');
      return { ar: pick('ar'), en: pick('en'), he: pick('he') };
    };
    const map = new Map<
      string,
      {
        price: string;
        sellable: boolean;
        productId: string;
        name: Translatable;
        variantLabel: Translatable | null;
        sku: string;
      }
    >();
    for (const r of rows) {
      const label =
        r.productType === 'NUMBERED'
          ? { ar: `#${r.number}`, en: `#${r.number}`, he: `#${r.number}` }
          : labels.has(r.itemId)
            ? join(labels.get(r.itemId)!)
            : null;
      map.set(r.itemId, {
        price: r.itemPrice ?? r.productPrice,
        sellable: r.status !== 'ARCHIVED' && r.itemActive && !r.itemArchived,
        productId: r.productId,
        name: r.name,
        variantLabel: label,
        sku: r.sku,
      });
    }
    return map;
  }

  // ------------------------------------------------------------------ repayments

  /**
   * Money from a customer against their debts: oldest unpaid sale first unless the cashier
   * picked sales; whatever is left becomes store credit.
   */
  async receivePayment(
    actor: Actor,
    customerId: string,
    input: z.output<typeof receivePaymentSchema>,
  ): Promise<PaymentReceipt> {
    const { result } = await this.idempotency.run(
      'payments.receive',
      input.idempotencyKey,
      actor.id,
      { customerId, ...input },
      async (tx) => {
        const customer = await this.customers.lock(tx, customerId);
        const defaultCurrency = await this.currencies.defaultCode(tx);
        const today = await this.ledger.today(tx);
        const needsShift = input.payments.some((p) => p.method === 'CASH');
        if (needsShift && !input.shiftId)
          throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
        const shift = input.shiftId ? await this.shifts.requireOpen(tx, input.shiftId) : null;
        const tendered: PricedPayment[] = [];
        for (const p of input.payments)
          tendered.push(await this.payments.price(tx, p, defaultCurrency));
        const totalIn = addMoney('0', ...tendered.map((p) => p.amountDefault));

        const open = await this.openSales(tx, customerId);
        let targets: { saleId: string; number: string; amount: string }[];
        if (input.allocations?.length) {
          targets = input.allocations.map((a) => {
            const s = open.find((o) => o.id === a.saleId);
            if (!s)
              throw badRequest(
                SALES_ERRORS.ALLOCATION_NOT_CUSTOMERS,
                'Not an open sale of this customer',
                {
                  saleId: a.saleId,
                },
              );
            if (compareMoney(a.amount, s.open) > 0)
              throw badRequest(SALES_ERRORS.ALLOCATION_TOO_LARGE, 'More than is open on the sale', {
                saleId: a.saleId,
                open: s.open,
              });
            return { saleId: s.id, number: s.number, amount: a.amount };
          });
          if (compareMoney(addMoney('0', ...targets.map((t) => t.amount)), totalIn) > 0)
            throw badRequest(SALES_ERRORS.ALLOCATION_TOO_LARGE, 'Allocations exceed the payment');
        } else {
          let left = totalIn;
          targets = [];
          // Oldest debt first; deposits on held goods are only paid when picked.
          for (const s of open.filter((o) => compareMoney(o.receivable, 0) > 0)) {
            if (compareMoney(left, 0) <= 0) break;
            const amount = minMoney(left, s.receivable);
            targets.push({ saleId: s.id, number: s.number, amount });
            left = addMoney(left, neg(amount));
          }
        }
        const allocatedTotal = addMoney('0', ...targets.map((t) => t.amount));
        const storeCredit = addMoney(
          '0',
          ...tendered.filter((p) => p.method === 'STORE_CREDIT').map((p) => p.amountDefault),
        );
        if (compareMoney(storeCredit, 0) > 0) {
          const balance = (await this.customers.balances(tx, [customerId])).get(customerId)!;
          if (compareMoney(storeCredit, balance.credit) > 0)
            throw conflict(SALES_ERRORS.CREDIT_INSUFFICIENT, 'Not enough store credit', {
              credit: balance.credit,
            });
          if (compareMoney(storeCredit, allocatedTotal) > 0)
            throw badRequest(SALES_ERRORS.ALLOCATION_TOO_LARGE, 'Store credit can only pay debts');
        }

        // Each sale's receivable is paid first; anything beyond it on a held sale is a deposit.
        const receivableLeft = new Map(open.map((o) => [o.id, o.receivable]));
        const queue = targets.map((t) => ({ ...t }));
        const party = { partyType: 'CUSTOMER' as const, partyId: customerId };
        const paymentIds: string[] = [];
        // Store credit first, so cash beyond the debts is what becomes credit.
        const ordered = [...tendered].sort(
          (a, b) => Number(b.method === 'STORE_CREDIT') - Number(a.method === 'STORE_CREDIT'),
        );
        for (const p of ordered) {
          let left = p.amountDefault;
          const counter: PostingLine[] = [];
          const allocations: { saleId: string; amount: string }[] = [];
          while (compareMoney(left, 0) > 0 && queue.length) {
            const t = queue[0]!;
            const take = minMoney(left, t.amount);
            const recv = minMoney(take, receivableLeft.get(t.saleId) ?? '0.00');
            const deposit = addMoney(take, neg(recv));
            receivableLeft.set(t.saleId, addMoney(receivableLeft.get(t.saleId) ?? '0', neg(recv)));
            counter.push(credit('CUSTOMER_RECEIVABLES', recv, { ...party, dimension: t.saleId }));
            counter.push(credit('CUSTOMER_CREDIT', deposit, { ...party, dimension: t.saleId }));
            allocations.push({ saleId: t.saleId, amount: take });
            t.amount = addMoney(t.amount, neg(take));
            left = addMoney(left, neg(take));
            if (compareMoney(t.amount, 0) === 0) queue.shift();
          }
          if (compareMoney(left, 0) > 0) counter.push(credit('CUSTOMER_CREDIT', left, party));
          const row = await this.payments.record(tx, {
            ...p,
            direction: 'IN',
            purpose: 'REPAYMENT',
            customerId,
            shiftId: shift?.id ?? null,
            takenBy: actor.id,
            businessDate: today,
            note: input.note,
            counter,
          });
          paymentIds.push(row.id);
          await this.payments.allocate(
            tx,
            allocations.map((a) => ({
              paymentId: row.id,
              saleId: a.saleId,
              amount: a.amount,
              createdBy: actor.id,
            })),
          );
        }
        const toCredit = addMoney(totalIn, neg(allocatedTotal));
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'PAYMENT_RECEIVE',
          entity: 'customer',
          entityId: customer.id,
          newValue: { payments: paymentIds, allocations: targets, toCredit },
          reason: input.note ?? null,
        });
        return { paymentIds, allocations: targets.map((t) => ({ ...t })), toCredit };
      },
    );
    const allocated = await this.db
      .select({
        saleId: paymentAllocations.saleId,
        number: sales.number,
        amount: sql<string>`sum(${paymentAllocations.amount})::text`,
      })
      .from(paymentAllocations)
      .innerJoin(sales, eq(sales.id, paymentAllocations.saleId))
      .where(inArray(paymentAllocations.paymentId, result.paymentIds))
      .groupBy(paymentAllocations.saleId, sales.number);
    return {
      payments: await this.payments.byIds(this.db, result.paymentIds),
      allocations: allocated.map((a) => ({
        saleId: a.saleId,
        saleNumber: a.number,
        amount: addMoney(a.amount),
      })),
      toCredit: result.toCredit,
      customer: await this.customers.get(customerId),
    };
  }

  /**
   * A customer's sales with something still open, oldest first: `open` is total minus paid;
   * `receivable` is the part already owed as debt (taken goods, or held goods handed over).
   */
  async openSales(executor: Executor | undefined, customerId: string) {
    const rows = await (executor ?? this.db)
      .select({
        id: sales.id,
        number: sales.number,
        createdAt: sales.createdAt,
        total: sales.total,
        returnedTotal: sales.returnedTotal,
        mode: sales.fulfilmentMode,
        paid: sql<string>`coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = ${sql.raw('sales.id')}), 0)::text`,
        receivable: sql<string>`coalesce((select sum(l.amount) from journal_lines l where l.account = 'CUSTOMER_RECEIVABLES' and l.party_type = 'CUSTOMER' and l.party_id = ${customerId} and l.dimension = ${sql.raw('sales.id')}::text), 0)::text`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.customerId, customerId),
          eq(sales.status, 'COMPLETED'),
          eq(sales.imported, false),
        ),
      )
      .orderBy(asc(sales.createdAt), asc(sales.number));
    return rows
      .map((r) => ({
        ...r,
        open: addMoney(r.total, neg(r.returnedTotal), neg(r.paid)),
        receivable: addMoney(r.receivable),
      }))
      .filter((r) => compareMoney(r.open, 0) > 0);
  }

  // ------------------------------------------------------------------ held goods

  async handover(
    actor: Actor,
    saleId: string,
    input: z.output<typeof handoverSchema>,
  ): Promise<SaleView> {
    await this.idempotency.run(
      'sales.handover',
      input.idempotencyKey,
      actor.id,
      { saleId, ...input },
      async (tx) => {
        const sale = await this.lockSale(tx, saleId);
        if (
          sale.status !== 'COMPLETED' ||
          sale.fulfilmentMode !== 'HELD' ||
          sale.fulfilmentStatus === 'FULFILLED'
        )
          throw conflict(SALES_ERRORS.NOT_HELD, 'Nothing is held on this sale');
        const customerId = sale.customerId!;
        await this.customers.lock(tx, customerId);
        const lines = await tx
          .select()
          .from(saleLines)
          .where(eq(saleLines.saleId, saleId))
          .orderBy(asc(saleLines.position));
        const wanted = input.lines?.length
          ? input.lines
          : lines
              .filter((l) => l.handedOver < l.quantity)
              .map((l) => ({ lineId: l.id, quantity: l.quantity - l.handedOver }));
        const picked = wanted.map((w) => {
          const line = lines.find((l) => l.id === w.lineId);
          if (!line || w.quantity > line.quantity - line.handedOver)
            throw badRequest(SALES_ERRORS.HANDOVER_TOO_MANY, 'More than is held', {
              lineId: w.lineId,
            });
          return { line, quantity: w.quantity };
        });
        const value = addMoney('0', ...picked.map((p) => handedValue(p.line, p.quantity)));
        const gross = addMoney(
          '0',
          ...picked.map((p) => multiplyMoney(p.line.unitPrice, p.quantity)),
        );
        const pool = await this.depositOn(tx, customerId, saleId);
        const applied = minMoney(value, pool);
        const owed = addMoney(value, neg(applied));
        if (compareMoney(owed, 0) > 0 && !input.acknowledgeOwed)
          throw conflict(SALES_ERRORS.OWED_NOT_ACKNOWLEDGED, 'Money is still owed on these goods', {
            owed,
          });

        const applied_ = await this.stock.apply(tx, {
          sourceType: 'sale',
          sourceId: saleId,
          event: 'HANDOVER',
          actorId: actor.id,
          lines: picked.map((p) => ({
            itemId: p.line.itemId!,
            quantity: -p.quantity,
            reason: 'SALE',
            counterAccount: 'COGS',
            fromReserved: true,
          })),
        });
        const party = { partyType: 'CUSTOMER' as const, partyId: customerId, dimension: saleId };
        await this.ledger.post(tx, {
          sourceType: 'sale',
          sourceId: saleId,
          event: 'HANDOVER',
          createdBy: actor.id,
          lines: [
            debit('CUSTOMER_CREDIT', applied, party),
            debit('CUSTOMER_RECEIVABLES', owed, party),
            debit('DISCOUNTS_GIVEN', addMoney(gross, neg(value))),
            credit('SALES_REVENUE', gross),
          ],
        });
        for (const p of picked) {
          const cost = applied_.movements.find((m) => m.itemId === p.line.itemId);
          await tx
            .update(saleLines)
            .set({
              handedOver: p.line.handedOver + p.quantity,
              ...(p.line.unitCost === null && cost
                ? { unitCost: cost.unitCost, costUnknown: cost.costUnknown }
                : {}),
            })
            .where(eq(saleLines.id, p.line.id));
        }
        const allHanded = lines.every(
          (l) =>
            l.handedOver + (picked.find((p) => p.line.id === l.id)?.quantity ?? 0) === l.quantity,
        );
        await tx
          .update(sales)
          .set({ fulfilmentStatus: allHanded ? 'FULFILLED' : 'PARTLY_HANDED' })
          .where(eq(sales.id, saleId));
        const [handover] = await tx
          .insert(saleHandovers)
          .values({
            saleId,
            value,
            depositApplied: applied,
            lines: picked.map((p) => ({ lineId: p.line.id, quantity: p.quantity })),
            owedAcknowledged: compareMoney(owed, 0) > 0,
            createdBy: actor.id,
          })
          .returning();
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'SALE_HANDOVER',
          entity: 'sale',
          entityId: saleId,
          newValue: { handoverId: handover!.id, value, applied, owed, lines: wanted },
        });
        return { id: handover!.id };
      },
    );
    return this.get(saleId);
  }

  /**
   * A held sale that will not be collected. The deposit is refunded, kept as store credit, or
   * kept by the shop (managers only); the reserved goods go back on sale.
   */
  async cancelHeld(
    actor: Actor,
    saleId: string,
    input: z.output<typeof cancelHeldSchema>,
  ): Promise<SaleView> {
    await this.idempotency.run(
      'sales.cancelHeld',
      input.idempotencyKey,
      actor.id,
      { saleId, ...input },
      async (tx) => {
        const sale = await this.lockSale(tx, saleId);
        if (
          sale.status !== 'COMPLETED' ||
          sale.fulfilmentMode !== 'HELD' ||
          sale.fulfilmentStatus === 'FULFILLED'
        )
          throw conflict(SALES_ERRORS.NOT_HELD, 'Nothing is held on this sale');
        if (sale.fulfilmentStatus === 'PARTLY_HANDED')
          throw conflict(SALES_ERRORS.PARTLY_HANDED, 'Part of it was handed over; use a return');
        const customerId = sale.customerId!;
        await this.customers.lock(tx, customerId);
        const settings = await this.settings.get(tx);
        const defaultCurrency = await this.currencies.defaultCode(tx);
        const today = await this.ledger.today(tx);
        const lines = await tx.select().from(saleLines).where(eq(saleLines.saleId, saleId));
        await this.stock.release(
          tx,
          lines.map((l) => ({ itemId: l.itemId!, quantity: l.quantity })),
        );
        const pool = await this.depositOn(tx, customerId, saleId);
        const onSale = { partyType: 'CUSTOMER' as const, partyId: customerId, dimension: saleId };
        const party = { partyType: 'CUSTOMER' as const, partyId: customerId };

        if (input.outcome === 'KEEP_DEPOSIT' && !roleCan(actor.role, 'sales.keepDeposit'))
          throw forbidden(
            SALES_ERRORS.KEEP_DEPOSIT_NEEDS_MANAGER,
            'Keeping a deposit needs a manager',
          );
        if (compareMoney(pool, 0) > 0) {
          if (input.outcome === 'REFUND') {
            if (!input.refundMethod)
              throw badRequest(SALES_ERRORS.REFUND_METHOD_REQUIRED, 'How is it refunded?');
            if (
              compareMoney(pool, settings.employeeRefundLimit) > 0 &&
              !roleCan(actor.role, 'refunds.aboveLimit')
            )
              throw forbidden(SALES_ERRORS.REFUND_NEEDS_MANAGER, 'This refund needs a manager');
            if (input.refundMethod === 'CASH' && !input.shiftId)
              throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
            const shift = input.shiftId ? await this.shifts.requireOpen(tx, input.shiftId) : null;
            await this.payments.record(tx, {
              method: input.refundMethod,
              currency: defaultCurrency,
              amount: pool,
              rate: '1',
              amountDefault: pool,
              direction: 'OUT',
              purpose: 'REFUND',
              customerId,
              shiftId: shift?.id ?? null,
              saleId,
              takenBy: actor.id,
              businessDate: today,
              note: input.reason,
              counter: [debit('CUSTOMER_CREDIT', pool, onSale)],
            });
          } else {
            await this.ledger.post(tx, {
              sourceType: 'sale',
              sourceId: saleId,
              event:
                input.outcome === 'CREDIT'
                  ? 'HELD_CANCELLED_TO_CREDIT'
                  : 'HELD_CANCELLED_DEPOSIT_KEPT',
              createdBy: actor.id,
              memo: input.reason,
              lines: [
                debit('CUSTOMER_CREDIT', pool, onSale),
                input.outcome === 'CREDIT'
                  ? credit('CUSTOMER_CREDIT', pool, party)
                  : credit('OTHER_INCOME', pool),
              ],
            });
          }
          // Refunded or moved to credit: the money no longer pays this sale.
          if (input.outcome !== 'KEEP_DEPOSIT') {
            const allocs = await tx
              .select()
              .from(paymentAllocations)
              .where(
                and(eq(paymentAllocations.saleId, saleId), isNull(paymentAllocations.reversesId)),
              );
            await this.payments.allocate(
              tx,
              allocs.map((a) => ({
                paymentId: a.paymentId,
                saleId,
                amount: neg(a.amount),
                reversesId: a.id,
                createdBy: actor.id,
              })),
            );
          }
        }
        await tx
          .update(sales)
          .set({
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: actor.id,
            cancelReason: input.reason,
            cancelOutcome: input.outcome,
          })
          .where(eq(sales.id, saleId));
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'SALE_CANCEL_HELD',
          entity: 'sale',
          entityId: saleId,
          newValue: { outcome: input.outcome, deposit: pool },
          reason: input.reason,
        });
        return { id: saleId };
      },
    );
    return this.get(saleId);
  }

  /** Deposit paid towards a held sale and not yet applied at a hand-over. */
  private async depositOn(executor: Executor, customerId: string, saleId: string): Promise<string> {
    const [row] = await executor
      .select({ total: sql<string>`coalesce(sum(${journalLines.amount}), 0)::text` })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.account, 'CUSTOMER_CREDIT'),
          eq(journalLines.partyType, 'CUSTOMER'),
          eq(journalLines.partyId, customerId),
          eq(journalLines.dimension, saleId),
        ),
      );
    return neg(addMoney(row?.total ?? '0'));
  }

  private async lockSale(tx: Transaction, id: string): Promise<Sale> {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).for('update');
    if (!sale) throw notFound('Sale');
    return sale;
  }

  // ------------------------------------------------------------------ reading

  async get(id: string, executor: Executor = this.db): Promise<SaleView> {
    const [row] = await executor
      .select({
        sale: sales,
        customerName: customers.name,
        customerPhone: customers.phone,
        shiftNumber: shifts.number,
        createdByName: users.name,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(shifts, eq(shifts.id, sales.shiftId))
      .leftJoin(users, eq(users.id, sales.createdBy))
      .where(eq(sales.id, id));
    if (!row) throw notFound('Sale');
    const s = row.sale;
    const lines = await executor
      .select({
        line: saleLines,
        image: sql<string | null>`coalesce(
          (select i.filename from product_images i where i.item_id = ${sql.raw('sale_lines.item_id')} and i.removed_at is null order by i.sort_order limit 1),
          (select i.filename from product_images i where i.product_id = ${sql.raw('sale_lines.product_id')} and i.removed_at is null order by i.is_primary desc, i.sort_order limit 1))`,
      })
      .from(saleLines)
      .where(eq(saleLines.saleId, id))
      .orderBy(asc(saleLines.position));
    const paymentRows = await this.payments.forSale(executor, id);
    const paid = addMoney('0', ...paymentRows.map((p) => p.allocated ?? '0'));
    const change = addMoney(
      '0',
      ...paymentRows.filter((p) => p.purpose === 'CHANGE').map((p) => p.amountDefault),
    );
    const atCheckout = paymentRows.filter((p) => p.purpose === 'SALE');
    const creditKept = addMoney(
      '0',
      ...atCheckout.map((p) => addMoney(p.amountDefault, neg(p.allocated ?? '0'))),
      neg(change),
    );
    const due = addMoney(s.total, neg(s.returnedTotal));
    const owed = s.status === 'COMPLETED' ? addMoney(due, neg(paid)) : '0.00';
    const held = s.status === 'COMPLETED' && s.fulfilmentStatus !== 'FULFILLED';
    const returnRows = await executor
      .select({
        id: saleReturns.id,
        number: saleReturns.number,
        kind: saleReturns.kind,
        value: saleReturns.value,
        createdAt: saleReturns.createdAt,
      })
      .from(saleReturns)
      .where(eq(saleReturns.saleId, id))
      .orderBy(asc(saleReturns.createdAt));
    const [origin] = await executor
      .select({ returnId: saleReturns.id, saleId: sales.id, saleNumber: sales.number })
      .from(saleReturns)
      .innerJoin(sales, eq(sales.id, saleReturns.saleId))
      .where(eq(saleReturns.exchangeSaleId, id));
    return {
      id: s.id,
      number: s.number,
      source: s.source,
      status: s.status,
      mode: s.fulfilmentMode,
      fulfilment: s.fulfilmentStatus,
      businessDate: s.businessDate,
      createdAt: s.createdAt.toISOString(),
      createdBy: s.createdBy ? { id: s.createdBy, name: row.createdByName ?? '' } : null,
      customer: s.customerId
        ? { id: s.customerId, name: row.customerName ?? '', phone: row.customerPhone }
        : null,
      shift: s.shiftId ? { id: s.shiftId, number: row.shiftNumber ?? '' } : null,
      lines: lines.map(({ line: l, image }) => ({
        id: l.id,
        itemId: l.itemId,
        productId: l.productId,
        name: l.name as Translatable,
        variantLabel: (l.variantLabel as Translatable | null) ?? null,
        sku: l.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        lineTotal: l.lineTotal,
        handedOver: l.handedOver,
        returned: l.returned,
        giveaway: l.giveaway,
        imageUrl: image ? `/uploads/${image}-thumbnail.webp` : null,
      })),
      subtotal: s.subtotal,
      discountTotal: s.discountTotal,
      total: s.total,
      returnedTotal: s.returnedTotal,
      paid,
      owed,
      paymentState: paymentState(due, paid),
      payments: paymentRows,
      change,
      creditKept: compareMoney(creditKept, 0) > 0 ? creditKept : '0.00',
      note: s.note,
      imported: s.imported,
      cancelReason: s.cancelReason,
      cancelOutcome: s.cancelOutcome,
      heldDays: held ? daysSince(s.createdAt) : null,
      giftReceipt: s.giftReceipt,
      returns: returnRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      exchangeOf: origin ?? null,
    };
  }

  async list(query: z.output<typeof saleListQuerySchema>): Promise<Page<SaleSummary>> {
    const paid = sql<string>`coalesce((select sum(a.amount) from payment_allocations a where a.sale_id = ${sql.raw('sales.id')}), 0)`;
    const due = sql`(${sales.total} - ${sales.returnedTotal})`;
    const where: (SQL | undefined)[] = [
      query.customerId ? eq(sales.customerId, query.customerId) : undefined,
      query.shiftId ? eq(sales.shiftId, query.shiftId) : undefined,
      query.from ? gte(sales.businessDate, query.from) : undefined,
      query.to ? lte(sales.businessDate, query.to) : undefined,
      query.held
        ? and(
            eq(sales.status, 'COMPLETED'),
            inArray(sales.fulfilmentStatus, ['HELD', 'PARTLY_HANDED']),
          )
        : undefined,
      query.state === 'PAID' ? sql`${paid} >= ${due}` : undefined,
      query.state === 'UNPAID'
        ? and(sql`${paid} = 0`, sql`${due} > 0`, eq(sales.status, 'COMPLETED'))
        : undefined,
      query.state === 'PARTLY_PAID'
        ? and(sql`${paid} > 0`, sql`${paid} < ${due}`, eq(sales.status, 'COMPLETED'))
        : undefined,
      query.state === 'OWED'
        ? and(sql`${paid} < ${due}`, eq(sales.status, 'COMPLETED'))
        : undefined,
    ];
    if (query.q) {
      const q = query.q.trim();
      const n = normalizeSearch(q);
      where.push(or(ilike(sales.number, `%${q}%`), ilike(customers.searchText, `%${n}%`)));
    }
    const filter = and(...where);
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(filter);
    const rows = await this.db
      .select({
        sale: sales,
        customerName: customers.name,
        paid: sql<string>`${paid}::text`,
        itemCount: sql<number>`(select coalesce(sum(l.quantity),0)::int from sale_lines l where l.sale_id = ${sql.raw('sales.id')})`,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(filter)
      .orderBy(desc(sales.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return {
      items: rows.map(({ sale: s, customerName, paid: p, itemCount }) => {
        const paidAmount = addMoney(p);
        const saleDue = addMoney(s.total, neg(s.returnedTotal));
        const held = s.status === 'COMPLETED' && s.fulfilmentStatus !== 'FULFILLED';
        return {
          id: s.id,
          number: s.number,
          createdAt: s.createdAt.toISOString(),
          customer: s.customerId ? { id: s.customerId, name: customerName ?? '' } : null,
          status: s.status,
          mode: s.fulfilmentMode,
          fulfilment: s.fulfilmentStatus,
          total: s.total,
          returnedTotal: s.returnedTotal,
          paid: paidAmount,
          owed: s.status === 'COMPLETED' ? addMoney(saleDue, neg(paidAmount)) : '0.00',
          paymentState: paymentState(saleDue, paidAmount),
          itemCount,
          imported: s.imported,
          heldDays: held ? daysSince(s.createdAt) : null,
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async receipt(id: string): Promise<ReceiptData> {
    const sale = await this.get(id);
    const shop = await this.settings.get();
    let customerBalance: string | null = null;
    if (sale.customer) {
      const b = (await this.customers.balances(this.db, [sale.customer.id])).get(sale.customer.id)!;
      customerBalance = addMoney(b.debt, neg(b.credit));
    }
    return {
      sale,
      shop: {
        name: shop.storeName,
        phone: shop.phone,
        address: shop.address,
        footer: shop.receiptFooter,
      },
      currency: await this.currencies.defaultCode(),
      customerBalance,
    };
  }
}

/** The value of `quantity` more units of a line, so the parts always add up to the line total. */
function handedValue(line: Line, quantity: number): string {
  const upTo = (n: number) => Math.round((toMinor(line.lineTotal) * n) / line.quantity);
  return fromMinor(upTo(line.handedOver + quantity) - upTo(line.handedOver));
}

function paymentState(total: string, paid: string): PaymentState {
  if (compareMoney(paid, total) >= 0) return 'PAID';
  return compareMoney(paid, 0) > 0 ? 'PARTLY_PAID' : 'UNPAID';
}

function daysSince(at: Date): number {
  return Math.floor((Date.now() - at.getTime()) / 86_400_000);
}
