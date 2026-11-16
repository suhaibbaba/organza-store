import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  addMoney,
  compareMoney,
  type createReturnSchema,
  fromMinor,
  multiplyMoney,
  type ReturnCondition,
  type ReturnKind,
  type ReturnView,
  roleCan,
  toMinor,
  type Translatable,
  type voidSaleSchema,
} from '@organza/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  customers,
  paymentAllocations,
  payments,
  saleLines,
  saleReturnLines,
  saleReturns,
  sales,
  users,
} from '../../../database/schema/index.js';
import {
  currentTransaction,
  type Database,
  type Executor,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../../ledger/services/ledger.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { StockService } from '../../stock/services/stock.service.js';
import { SALES_ERRORS } from '../constants.js';
import { CustomersService } from './customers.service.js';
import { PaymentsService } from './payments.service.js';
import { SalesService } from './sales.service.js';
import { ShiftsService } from './shifts.service.js';

const neg = (amount: string) => fromMinor(-toMinor(amount));
const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);
const ZERO = '0.00';

type Line = typeof saleLines.$inferSelect;
type Settlement = z.output<typeof voidSaleSchema>;

interface Request {
  kind: ReturnKind;
  saleId: string;
  lines: { lineId: string; quantity: number; condition: ReturnCondition }[];
  exchange?: z.output<typeof createReturnSchema>['exchange'];
  settlement: Settlement;
}

/**
 * Returns, exchanges and voids (proposal C6, scenarios 5–7). One document per event, in one
 * transaction with its stock movements, its journal entries, any refund and its audit row.
 *
 * Money: the returned value first clears what is still owed on the sale (a debt sale returned
 * costs nobody cash), then pays for the new goods of an exchange, and only the rest goes back
 * to the customer or to store credit. Allocations follow the money, so "paid" on each sale
 * stays true.
 */
@Injectable()
export class ReturnsService {
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
    private readonly sales: SalesService,
  ) {}

  async create(
    actor: Actor,
    input: z.output<typeof createReturnSchema>,
    approvedBy?: string,
  ): Promise<ReturnView> {
    const { result } = await this.idempotency.run(
      'sales.return',
      input.idempotencyKey,
      actor.id,
      input,
      (tx) =>
        this.within(
          tx,
          actor,
          {
            kind: input.exchange ? 'EXCHANGE' : 'RETURN',
            saleId: input.saleId,
            lines: input.lines.map((l) => ({
              lineId: l.lineId,
              quantity: l.quantity,
              condition: l.condition,
            })),
            exchange: input.exchange,
            settlement: input,
          },
          approvedBy,
        ),
    );
    return this.get(result.id);
  }

  /** A manager reverses a completed sale: everything not yet returned goes back on the shelf. */
  async voidSale(
    actor: Actor,
    saleId: string,
    input: Settlement,
    approvedBy?: string,
  ): Promise<ReturnView> {
    if (!approvedBy && !roleCan(actor.role, 'sales.void'))
      throw forbidden(SALES_ERRORS.VOID_NEEDS_MANAGER, 'Voiding a sale needs a manager');
    const { result } = await this.idempotency.run(
      'sales.void',
      input.idempotencyKey,
      actor.id,
      { saleId, ...input },
      async (tx) => {
        const lines = await tx.select().from(saleLines).where(eq(saleLines.saleId, saleId));
        return this.within(
          tx,
          actor,
          {
            kind: 'VOID',
            saleId,
            lines: lines
              .filter((l) => returnable(l) > 0)
              .map((l) => ({ lineId: l.id, quantity: returnable(l), condition: 'SHELF' })),
            settlement: input,
          },
          approvedBy,
        );
      },
    );
    return this.get(result.id);
  }

  private async within(tx: Transaction, actor: Actor, req: Request, approvedBy?: string) {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, req.saleId)).for('update');
    if (!sale) throw notFound('Sale');
    if (sale.status !== 'COMPLETED')
      throw conflict(SALES_ERRORS.NOT_RETURNABLE, 'Only completed sales can take returns');
    if (sale.fulfilmentStatus !== 'FULFILLED')
      throw conflict(
        SALES_ERRORS.NOT_RETURNABLE,
        'Goods still held: hand them over or cancel the held sale first',
      );
    if (!req.lines.length)
      throw badRequest(SALES_ERRORS.NOTHING_TO_RETURN, 'Nothing left to return on this sale');
    if (sale.customerId) await this.customers.lock(tx, sale.customerId);
    const settings = await this.settings.get(tx);
    const defaultCurrency = await this.currencies.defaultCode(tx);
    const today = await this.ledger.today(tx);
    const s = req.settlement;
    const shift = s.shiftId ? await this.shifts.requireOpen(tx, s.shiftId) : null;

    // Lines: never more back than went out (also a CHECK on sale_lines.returned).
    const all = await tx
      .select()
      .from(saleLines)
      .where(eq(saleLines.saleId, sale.id))
      .orderBy(asc(saleLines.position))
      .for('update');
    const byId = new Map(all.map((l) => [l.id, l]));
    const asked = new Map<string, number>();
    for (const r of req.lines) asked.set(r.lineId, (asked.get(r.lineId) ?? 0) + r.quantity);
    for (const [lineId, quantity] of asked) {
      const line = byId.get(lineId);
      if (!line) throw badRequest(SALES_ERRORS.RETURN_LINE_UNKNOWN, 'Not a line of this sale');
      if (quantity > returnable(line))
        throw conflict(SALES_ERRORS.RETURN_TOO_MANY, 'More than is left to return', {
          lineId,
          returnable: returnable(line),
        });
    }
    const counted = new Map<string, number>();
    const picked = req.lines.map((r) => {
      const line = byId.get(r.lineId)!;
      const before = line.returned + (counted.get(line.id) ?? 0);
      counted.set(line.id, (counted.get(line.id) ?? 0) + r.quantity);
      const value = partValue(line, before, r.quantity);
      const gross = multiplyMoney(line.unitPrice, r.quantity);
      return { ...r, line, gross, value, discount: addMoney(gross, neg(value)) };
    });
    const value = addMoney(ZERO, ...picked.map((p) => p.value));
    const gross = addMoney(ZERO, ...picked.map((p) => p.gross));
    const discount = addMoney(gross, neg(value));

    // What is still owed on the sale is cleared first; the rest was paid and goes somewhere.
    const [paidRow] = await tx
      .select({ paid: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)::text` })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.saleId, sale.id));
    const paid = addMoney(paidRow?.paid ?? ZERO);
    const owedBefore = addMoney(sale.total, neg(sale.returnedTotal), neg(paid));
    if (sale.imported && compareMoney(owedBefore, 0) > 0)
      throw conflict(
        SALES_ERRORS.IMPORTED_UNPAID,
        'This old-system sale is not settled; settle it before taking a return',
      );
    const debtReduced = minMoney(value, compareMoney(owedBefore, 0) > 0 ? owedBefore : ZERO);
    const paidBack = addMoney(value, neg(debtReduced));

    const number = await this.documents.next(tx, req.kind === 'VOID' ? 'V' : 'R');
    // The document is written once, at the end, with its settlement; its id is known now so the
    // stock movements and journal entries can point at it.
    const returnId = randomUUID();
    const onSale = sale.customerId
      ? { partyType: 'CUSTOMER' as const, partyId: sale.customerId, dimension: sale.id }
      : { dimension: sale.id };
    const party = sale.customerId
      ? { partyType: 'CUSTOMER' as const, partyId: sale.customerId }
      : {};

    for (const [lineId, quantity] of counted)
      await tx
        .update(saleLines)
        .set({ returned: byId.get(lineId)!.returned + quantity })
        .where(eq(saleLines.id, lineId));
    await tx
      .update(sales)
      .set({
        returnedTotal: addMoney(sale.returnedTotal, value),
        ...(req.kind === 'VOID' && {
          status: 'VOIDED' as const,
          cancelledAt: new Date(),
          cancelledBy: actor.id,
          cancelReason: s.reason,
        }),
      })
      .where(eq(sales.id, sale.id));

    // Stock back at the cost it left with: shelf pieces to inventory, damaged ones to the
    // damaged bucket (their cost becomes a loss). A giveaway reverses its promotion expense.
    const withItem = picked.filter((p) => p.line.itemId);
    if (withItem.length)
      await this.stock.apply(tx, {
        sourceType: 'sale_return',
        sourceId: returnId,
        event: req.kind,
        actorId: actor.id,
        entryDate: today,
        lines: withItem.map((p) => ({
          itemId: p.line.itemId!,
          bucket: p.condition === 'DAMAGED' ? 'DAMAGED' : 'ON_HAND',
          quantity: p.quantity,
          reason: p.condition === 'DAMAGED' ? 'RETURN_DAMAGED' : 'RETURN_TO_SHELF',
          ...(p.line.unitCost !== null
            ? { unitCost: p.line.unitCost }
            : p.condition === 'DAMAGED'
              ? { unitCost: '0' }
              : {}),
          counterAccount: p.line.giveaway ? 'PROMOTIONS' : 'COGS',
        })),
      });

    // Revenue comes off for the value returned; the sale's receivable goes down by it.
    if (compareMoney(gross, 0) > 0)
      await this.ledger.post(tx, {
        sourceType: 'sale_return',
        sourceId: returnId,
        event: req.kind,
        createdBy: actor.id,
        entryDate: today,
        memo: s.reason,
        lines: [
          debit('SALES_REVENUE', gross),
          credit('DISCOUNTS_GIVEN', discount),
          credit('CUSTOMER_RECEIVABLES', value, onSale),
        ],
      });

    // The paid part: towards the new goods first, then back to the customer or to credit.
    let toExchange = ZERO;
    let exchangeSaleId: string | null = null;
    let rest = paidBack;
    if (req.exchange) {
      if (!shift) throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
      const created = await this.sales.checkoutWithin(
        tx,
        actor,
        {
          idempotencyKey: `${s.idempotencyKey}:exchange`,
          shiftId: shift.id,
          customerId: sale.customerId,
          source: 'COUNTER',
          mode: 'TAKEN',
          lines: req.exchange.lines,
          cartDiscount: req.exchange.cartDiscount,
          payments: req.exchange.payments,
          overpayment: 'CHANGE',
          confirmDuplicate: true,
          giftReceipt: false,
          note: `${number}`,
        },
        { credit: paidBack },
      );
      exchangeSaleId = created.id;
      toExchange = created.credited;
      rest = addMoney(paidBack, neg(toExchange));
      if (compareMoney(toExchange, 0) > 0) {
        const newParty = sale.customerId
          ? { partyType: 'CUSTOMER' as const, partyId: sale.customerId, dimension: created.id }
          : { dimension: created.id };
        await this.ledger.post(tx, {
          sourceType: 'sale_return',
          sourceId: returnId,
          event: 'EXCHANGE_APPLIED',
          createdBy: actor.id,
          entryDate: today,
          lines: [
            debit('CUSTOMER_RECEIVABLES', toExchange, onSale),
            credit('CUSTOMER_RECEIVABLES', toExchange, newParty),
          ],
        });
        // The same payments now pay the new sale.
        const moved = await this.release(tx, sale.id, toExchange, actor.id);
        await this.payments.allocate(
          tx,
          moved.map((m) => ({
            paymentId: m.paymentId,
            saleId: created.id,
            amount: m.amount,
            createdBy: actor.id,
          })),
        );
      }
    }

    let refunded = ZERO;
    let toCredit = ZERO;
    let refundMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | null = null;
    if (compareMoney(rest, 0) > 0) {
      const original = await this.originalMethod(tx, sale.id);
      const settlement =
        s.settlement === 'REFUND' && !s.refundMethod && original === 'STORE_CREDIT'
          ? 'CREDIT'
          : s.settlement;
      if (settlement === 'CREDIT') {
        if (!sale.customerId)
          throw badRequest(SALES_ERRORS.CUSTOMER_REQUIRED, 'Store credit needs a customer');
        toCredit = rest;
        await this.ledger.post(tx, {
          sourceType: 'sale_return',
          sourceId: returnId,
          event: 'RETURN_TO_CREDIT',
          createdBy: actor.id,
          entryDate: today,
          lines: [
            debit('CUSTOMER_RECEIVABLES', rest, onSale),
            credit('CUSTOMER_CREDIT', rest, party),
          ],
        });
      } else {
        refundMethod =
          s.refundMethod ?? (original && original !== 'STORE_CREDIT' ? original : 'CASH');
        if (
          compareMoney(rest, settings.employeeRefundLimit) > 0 &&
          !approvedBy &&
          !roleCan(actor.role, 'refunds.aboveLimit')
        )
          throw forbidden(SALES_ERRORS.REFUND_NEEDS_MANAGER, 'This refund needs a manager');
        if (refundMethod === 'CASH' && !shift)
          throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
        refunded = rest;
        await this.payments.record(tx, {
          method: refundMethod,
          currency: defaultCurrency,
          amount: rest,
          rate: '1',
          amountDefault: rest,
          direction: 'OUT',
          purpose: 'REFUND',
          customerId: sale.customerId,
          shiftId: refundMethod === 'CASH' ? shift!.id : (shift?.id ?? null),
          saleId: sale.id,
          takenBy: actor.id,
          businessDate: today,
          note: `${number} ${s.reason}`,
          counter: [debit('CUSTOMER_RECEIVABLES', rest, onSale)],
        });
      }
      // Either way the money no longer pays this sale.
      await this.release(tx, sale.id, rest, actor.id);
    }

    await tx.insert(saleReturns).values({
      id: returnId,
      number,
      kind: req.kind,
      saleId: sale.id,
      customerId: sale.customerId,
      shiftId: shift?.id ?? null,
      businessDate: today,
      value,
      debtReduced,
      toExchange,
      refunded,
      refundMethod,
      toCredit,
      exchangeSaleId,
      reason: s.reason,
      createdBy: actor.id,
      approvedBy: approvedBy ?? null,
    });
    await tx.insert(saleReturnLines).values(
      picked.map((p) => ({
        returnId,
        saleLineId: p.line.id,
        itemId: p.line.itemId,
        quantity: p.quantity,
        condition: p.condition,
        gross: p.gross,
        discount: p.discount,
        value: p.value,
      })),
    );

    await this.audit.record(tx, {
      userId: actor.id,
      action: req.kind === 'VOID' ? 'SALE_VOID' : req.kind === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
      entity: 'sale',
      entityId: sale.id,
      newValue: {
        number,
        value,
        debtReduced,
        toExchange,
        exchangeSaleId,
        refunded,
        refundMethod,
        toCredit,
        lines: picked.map((p) => ({
          lineId: p.line.id,
          quantity: p.quantity,
          condition: p.condition,
          value: p.value,
        })),
        approvedBy: approvedBy ?? null,
      },
      reason: s.reason,
    });
    return { id: returnId, number };
  }

  /** Takes `amount` off the sale's allocations, newest payment first; returns what moved. */
  private async release(tx: Transaction, saleId: string, amount: string, actorId: string) {
    const rows = await tx
      .select({
        paymentId: paymentAllocations.paymentId,
        net: sql<string>`sum(${paymentAllocations.amount})::text`,
        last: sql<Date>`max(${paymentAllocations.createdAt})`,
      })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.saleId, saleId))
      .groupBy(paymentAllocations.paymentId)
      .orderBy(desc(sql`max(${paymentAllocations.createdAt})`));
    let left = amount;
    const moved: { paymentId: string; amount: string }[] = [];
    for (const r of rows) {
      if (compareMoney(left, 0) <= 0) break;
      const take = minMoney(addMoney(r.net), left);
      if (compareMoney(take, 0) <= 0) continue;
      moved.push({ paymentId: r.paymentId, amount: take });
      left = addMoney(left, neg(take));
    }
    await this.payments.allocate(
      tx,
      moved.map((m) => ({
        paymentId: m.paymentId,
        saleId,
        amount: neg(m.amount),
        createdBy: actorId,
      })),
    );
    return moved;
  }

  /** How most of the sale was paid; refunds go back the same way unless told otherwise. */
  private async originalMethod(executor: Executor, saleId: string) {
    const [row] = await executor
      .select({ method: payments.method })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .where(and(eq(paymentAllocations.saleId, saleId), eq(payments.direction, 'IN')))
      .groupBy(payments.method)
      .orderBy(desc(sql`sum(${paymentAllocations.amount})`))
      .limit(1);
    return row?.method ?? null;
  }

  // ------------------------------------------------------------------ reading

  async get(id: string, executor: Executor = currentTransaction() ?? this.db): Promise<ReturnView> {
    const [row] = await executor
      .select({
        r: saleReturns,
        saleNumber: sales.number,
        customerName: customers.name,
        createdByName: users.name,
      })
      .from(saleReturns)
      .innerJoin(sales, eq(sales.id, saleReturns.saleId))
      .leftJoin(customers, eq(customers.id, saleReturns.customerId))
      .innerJoin(users, eq(users.id, saleReturns.createdBy))
      .where(eq(saleReturns.id, id));
    if (!row) throw notFound('Return');
    const r = row.r;
    const lines = await executor
      .select({ rl: saleReturnLines, line: saleLines })
      .from(saleReturnLines)
      .innerJoin(saleLines, eq(saleLines.id, saleReturnLines.saleLineId))
      .where(eq(saleReturnLines.returnId, id))
      .orderBy(asc(saleLines.position));
    const exchange = r.exchangeSaleId
      ? (
          await executor
            .select({ id: sales.id, number: sales.number, total: sales.total })
            .from(sales)
            .where(eq(sales.id, r.exchangeSaleId))
        )[0]
      : undefined;
    const approver = r.approvedBy
      ? (
          await executor.select({ name: users.name }).from(users).where(eq(users.id, r.approvedBy))
        )[0]
      : undefined;
    return {
      id: r.id,
      number: r.number,
      kind: r.kind,
      sale: { id: r.saleId, number: row.saleNumber },
      customer: r.customerId ? { id: r.customerId, name: row.customerName ?? '' } : null,
      createdAt: r.createdAt.toISOString(),
      createdBy: row.createdByName,
      approvedBy: approver?.name ?? null,
      value: r.value,
      debtReduced: r.debtReduced,
      toExchange: r.toExchange,
      refunded: r.refunded,
      refundMethod: r.refundMethod,
      toCredit: r.toCredit,
      exchangeSale: exchange ?? null,
      reason: r.reason,
      lines: lines.map(({ rl, line }) => ({
        id: rl.id,
        saleLineId: rl.saleLineId,
        name: line.name as Translatable,
        variantLabel: (line.variantLabel as Translatable | null) ?? null,
        quantity: rl.quantity,
        condition: rl.condition,
        value: rl.value,
      })),
    };
  }

  async forSales(executor: Executor, saleIds: string[]) {
    if (!saleIds.length) return [];
    return executor.select().from(saleReturns).where(inArray(saleReturns.saleId, saleIds));
  }
}

/** Pieces of a line that went out and have not come back. */
function returnable(line: Line): number {
  return line.quantity - line.returned;
}

/** The value of `quantity` more pieces of a line, so the parts always add up to its total. */
function partValue(line: Line, before: number, quantity: number): string {
  const upTo = (n: number) => Math.round((toMinor(line.lineTotal) * n) / line.quantity);
  return fromMinor(upTo(before + quantity) - upTo(before));
}
