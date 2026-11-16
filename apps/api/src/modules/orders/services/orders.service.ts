import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  addMoney,
  collectOrderSchema,
  compareMoney,
  createOrderSchema,
  EDITABLE_ORDER_STATUSES,
  fromMinor,
  multiplyMoney,
  OPEN_ORDER_STATUSES,
  orderDepositSchema,
  orderListQuerySchema,
  type OrderLineView,
  type OrderStatus,
  type OrderSummary,
  type OrderView,
  type Page,
  returnedOrderSchema,
  shipOrderSchema,
  toMinor,
  type Translatable,
  updateOrderSchema,
} from '@organza/shared';
import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  couriers,
  courierSettlementLines,
  customers,
  itemBalances,
  items,
  orderEvents,
  orderLines,
  orders,
  payments,
  sales,
  users,
} from '../../../database/schema/index.js';
import {
  currentTransaction,
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { credit } from '../../ledger/services/ledger.service.js';
import { LedgerService } from '../../ledger/services/ledger.service.js';
import { SALES_ERRORS } from '../../sales/constants.js';
import { CustomersService } from '../../sales/services/customers.service.js';
import { PaymentsService } from '../../sales/services/payments.service.js';
import { ReturnsService } from '../../sales/services/returns.service.js';
import { SalesService } from '../../sales/services/sales.service.js';
import { ShiftsService } from '../../sales/services/shifts.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';
import { StockService } from '../../stock/services/stock.service.js';

export const ORDER_ERRORS = {
  WRONG_STATUS: 'ORDER_WRONG_STATUS',
  NOT_EDITABLE: 'ORDER_NOT_EDITABLE',
  STALE: 'ORDER_STALE',
  NOT_RESERVED: 'ORDER_NOT_RESERVED',
  COURIER_REQUIRED: 'ORDER_COURIER_REQUIRED',
  COURIER_INACTIVE: 'COURIER_INACTIVE',
  NOT_PICKUP: 'ORDER_NOT_PICKUP',
  NOT_COURIER: 'ORDER_NOT_COURIER',
  ALREADY_SETTLED: 'ORDER_ALREADY_SETTLED',
  FINISHED: 'ORDER_FINISHED',
  POSSIBLE_DUPLICATE: 'POSSIBLE_DUPLICATE',
  ITEM_NOT_SELLABLE: 'ITEM_NOT_SELLABLE',
  DISCOUNT_TOO_LARGE: 'DISCOUNT_TOO_LARGE',
} as const;

const ZERO = '0.00';
const neg = (amount: string) => fromMinor(-toMinor(amount));
const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);
const HELD_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY'];
const FINISHED: OrderStatus[] = ['OUT', 'COLLECTED', 'CANCELLED', 'RETURNED'];

type OrderRow = typeof orders.$inferSelect;
type LineInput = z.output<typeof createOrderSchema>['lines'][number];

/**
 * Orders (proposal C7, workflow D "Order preparation"). An order reserves stock when it is
 * confirmed and becomes a sale only at hand-over, which is when revenue is recognised. Every
 * step runs in one transaction with its stock, money and audit rows, and only from the status
 * it belongs to, so a second click changes nothing.
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly stock: StockService,
    private readonly sales: SalesService,
    private readonly returns: ReturnsService,
    private readonly payments: PaymentsService,
    private readonly customers: CustomersService,
    private readonly shifts: ShiftsService,
    private readonly currencies: CurrenciesService,
  ) {}

  // ------------------------------------------------------------------ taking orders

  async create(actor: Actor, input: z.output<typeof createOrderSchema>): Promise<OrderView> {
    const { result } = await this.idempotency.run(
      'orders.create',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const customer = await this.customers.lock(tx, input.customerId);
        if (input.courierId) await this.requireCourier(tx, input.courierId);
        const priced = await this.price(tx, input.lines);
        if (!input.confirmDuplicate) await this.assertNotDuplicate(tx, customer.id, input.lines);
        const number = await this.documents.next(tx, 'ORD');
        const [row] = await tx
          .insert(orders)
          .values({
            number,
            source: input.source,
            customerId: customer.id,
            delivery: input.delivery,
            courierId: input.delivery === 'COURIER' ? (input.courierId ?? null) : null,
            address: input.address ?? customer.address,
            city: input.city ?? customer.city,
            note: input.note,
            createdBy: actor.id,
          })
          .returning();
        await tx.insert(orderLines).values(
          priced.map((l, i) => ({
            orderId: row!.id,
            position: i + 1,
            itemId: l.itemId,
            quantity: l.quantity,
            unitPrice: l.price,
            discount: l.discount,
          })),
        );
        await this.event(tx, row!.id, null, 'NEW', actor, input.note);
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'ORDER_CREATE',
          entity: 'order',
          entityId: row!.id,
          newValue: { number, source: input.source, lines: input.lines },
        });
        return { id: row!.id };
      },
    );
    return this.get(result.id);
  }

  /**
   * Details and lines, until the order is ready. Lines are replaced as a whole; on a reserved
   * order the old reservations are released and the new lines reserved as far as stock allows.
   */
  async update(
    actor: Actor,
    id: string,
    input: z.output<typeof updateOrderSchema>,
  ): Promise<OrderView> {
    await inTransaction(this.db, async (tx) => {
      const order = await this.lock(tx, id);
      if (order.version !== input.version)
        throw conflict(ORDER_ERRORS.STALE, 'The order changed since it was opened');
      if (FINISHED.includes(order.status))
        throw conflict(ORDER_ERRORS.FINISHED, 'A finished order cannot change');
      const delivery = input.delivery ?? order.delivery;
      const courierId =
        delivery === 'PICKUP'
          ? null
          : input.courierId === undefined
            ? order.courierId
            : input.courierId;
      if (courierId && courierId !== order.courierId) await this.requireCourier(tx, courierId);
      const before = input.lines ? await this.linesOf(tx, id) : null;
      if (input.lines) {
        if (!EDITABLE_ORDER_STATUSES.includes(order.status))
          throw conflict(ORDER_ERRORS.NOT_EDITABLE, 'Lines are fixed once the order is ready');
        const priced = await this.price(tx, input.lines, before!);
        await this.releaseLines(tx, before!);
        await tx.delete(orderLines).where(eq(orderLines.orderId, id));
        const inserted = await tx
          .insert(orderLines)
          .values(
            priced.map((l, i) => ({
              orderId: id,
              position: i + 1,
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.price,
              discount: l.discount,
            })),
          )
          .returning();
        if (HELD_STATUSES.includes(order.status)) await this.reserveLines(tx, inserted);
      }
      await tx
        .update(orders)
        .set({
          delivery,
          courierId,
          ...(input.address !== undefined && { address: input.address }),
          ...(input.city !== undefined && { city: input.city }),
          ...(input.note !== undefined && { note: input.note }),
          version: order.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'ORDER_UPDATE',
        entity: 'order',
        entityId: id,
        oldValue: {
          delivery: order.delivery,
          courierId: order.courierId,
          address: order.address,
          city: order.city,
          note: order.note,
          lines: before?.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        },
        newValue: input,
      });
    });
    return this.get(id);
  }

  // ------------------------------------------------------------------ steps

  /** New → Confirmed: stock is reserved line by line, as far as it goes. */
  confirm(actor: Actor, id: string, note: string | null) {
    return this.step(actor, id, 'NEW', 'CONFIRMED', note, async (tx) => {
      await this.reserveLines(tx, await this.linesOf(tx, id));
    });
  }

  prepare(actor: Actor, id: string, note: string | null) {
    return this.step(actor, id, 'CONFIRMED', 'PREPARING', note);
  }

  /** Preparing → Ready: every line must be fully reserved (short lines are reduced or removed). */
  ready(actor: Actor, id: string, note: string | null) {
    return this.step(actor, id, 'PREPARING', 'READY', note, async (tx) => {
      const short = (await this.linesOf(tx, id)).filter((l) => l.reserved < l.quantity);
      if (short.length)
        throw conflict(ORDER_ERRORS.NOT_RESERVED, 'Some lines are not in stock', {
          lines: short.map((l) => ({ lineId: l.id, quantity: l.quantity, reserved: l.reserved })),
        });
    });
  }

  /** Tries again to reserve what was short (stock came in, or another order let go). */
  async reserveAgain(actor: Actor, id: string): Promise<OrderView> {
    await inTransaction(this.db, async (tx) => {
      const order = await this.lock(tx, id);
      if (!HELD_STATUSES.includes(order.status) || order.status === 'READY')
        throw conflict(ORDER_ERRORS.WRONG_STATUS, 'Only confirmed or preparing orders reserve');
      await this.reserveLines(tx, await this.linesOf(tx, id));
      await this.bump(tx, order);
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'ORDER_RESERVE',
        entity: 'order',
        entityId: id,
      });
    });
    return this.get(id);
  }

  /** Any open order can be cancelled; reservations are released and deposits stay as credit. */
  cancel(actor: Actor, id: string, reason: string) {
    return this.step(actor, id, ['NEW', ...HELD_STATUSES], 'CANCELLED', reason, async (tx) => {
      await this.releaseLines(tx, await this.linesOf(tx, id));
      await tx.update(orders).set({ cancelReason: reason }).where(eq(orders.id, id));
    });
  }

  /**
   * Ready → Out: the parcel goes with a courier. The sale is made now (revenue, stock out at
   * cost); the deposit pays first and what is still due becomes cash on delivery that the
   * delivery company owes.
   */
  ship(actor: Actor, id: string, input: z.output<typeof shipOrderSchema>) {
    return this.handOver(actor, id, input.idempotencyKey, 'OUT', input.note, async (tx, order) => {
      if (order.delivery !== 'COURIER')
        throw conflict(ORDER_ERRORS.NOT_COURIER, 'This order is collected at the shop');
      const courierId = input.courierId ?? order.courierId;
      if (!courierId) throw badRequest(ORDER_ERRORS.COURIER_REQUIRED, 'Choose a delivery company');
      await this.requireCourier(tx, courierId);
      return { courierId, shiftId: input.shiftId, payments: [], overpayment: 'CHANGE' as const };
    });
  }

  /** Ready → Collected: the customer takes it at the shop and pays now or owes it. */
  collect(actor: Actor, id: string, input: z.output<typeof collectOrderSchema>) {
    return this.handOver(
      actor,
      id,
      input.idempotencyKey,
      'COLLECTED',
      input.note,
      async (_tx, order) => {
        if (order.delivery !== 'PICKUP')
          throw conflict(ORDER_ERRORS.NOT_PICKUP, 'This order goes with a courier');
        return {
          courierId: null,
          shiftId: input.shiftId,
          payments: input.payments,
          overpayment: input.overpayment,
        };
      },
    );
  }

  /**
   * Out → Returned: the customer refused the parcel. Each piece goes back to the shelf or to
   * damaged, the sale is returned in full, and the courier no longer owes its cash on delivery
   * (a deposit becomes the customer's credit).
   */
  async returned(
    actor: Actor,
    id: string,
    input: z.output<typeof returnedOrderSchema>,
  ): Promise<OrderView> {
    await this.idempotency.run('orders.returned', input.idempotencyKey, actor.id, input, (tx) =>
      this.stepWithin(tx, actor, id, 'OUT', 'RETURNED', input.reason, async (order) => {
        const settled = await this.settledOf(tx, [id]);
        if (compareMoney(settled.get(id) ?? ZERO, 0) > 0)
          throw conflict(ORDER_ERRORS.ALREADY_SETTLED, 'The courier already paid for this order');
        const lines = await this.linesOf(tx, id);
        const condition = new Map(input.lines.map((l) => [l.lineId, l.condition]));
        const saleLines = await this.sales.get(order.saleId!, tx);
        await this.returns.within(tx, actor, {
          kind: 'RETURN',
          saleId: order.saleId!,
          // Sale lines were made from the order lines in the same order.
          lines: saleLines.lines
            .map((l, i) => ({
              lineId: l.id,
              quantity: l.quantity - l.returned,
              condition: condition.get(lines[i]?.id ?? '') ?? ('SHELF' as const),
            }))
            .filter((l) => l.quantity > 0),
          settlement: {
            idempotencyKey: randomUUID(),
            shiftId: input.shiftId,
            settlement: 'REFUND',
            reason: input.reason,
            parcel: { courierId: order.courierId!, amount: order.cod },
          },
        });
      }).then(() => ({ id })),
    );
    return this.get(id);
  }

  /** Money taken before hand-over. It is the customer's credit and pays first at hand-over. */
  async deposit(
    actor: Actor,
    id: string,
    input: z.output<typeof orderDepositSchema>,
  ): Promise<OrderView> {
    await this.idempotency.run(
      'orders.deposit',
      input.idempotencyKey,
      actor.id,
      input,
      async (tx) => {
        const order = await this.lock(tx, id);
        if (FINISHED.includes(order.status))
          throw conflict(ORDER_ERRORS.FINISHED, 'A finished order takes no deposit');
        await this.customers.lock(tx, order.customerId);
        const defaultCurrency = await this.currencies.defaultCode(tx);
        const priced = await this.payments.price(tx, input.payment, defaultCurrency);
        if (priced.method === 'CASH' && !input.shiftId)
          throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
        const shift = input.shiftId ? await this.shifts.requireOpen(tx, input.shiftId) : null;
        const party = { partyType: 'CUSTOMER' as const, partyId: order.customerId };
        const row = await this.payments.record(tx, {
          ...priced,
          direction: 'IN',
          purpose: 'DEPOSIT',
          customerId: order.customerId,
          shiftId: shift?.id ?? null,
          orderId: id,
          takenBy: actor.id,
          businessDate: await this.ledger.today(tx),
          note: order.number,
          counter: [credit('CUSTOMER_CREDIT', priced.amountDefault, party)],
        });
        await this.bump(tx, order);
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'ORDER_DEPOSIT',
          entity: 'order',
          entityId: id,
          newValue: { paymentId: row.id, amount: priced.amountDefault, method: priced.method },
        });
        return { id };
      },
    );
    return this.get(id);
  }

  // ------------------------------------------------------------------ reading

  async get(id: string, executor: Executor = currentTransaction() ?? this.db): Promise<OrderView> {
    const [row] = await executor
      .select({
        order: orders,
        customerName: customers.name,
        customerPhone: customers.phone,
        courierName: couriers.name,
        saleNumber: sales.number,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(couriers, eq(couriers.id, orders.courierId))
      .leftJoin(sales, eq(sales.id, orders.saleId))
      .where(eq(orders.id, id));
    if (!row) throw notFound('Order');
    const [summary] = await this.summaries(executor, [row.order]);
    const lines = await this.lineViews(executor, id, row.order.status);
    const events = await executor
      .select({ event: orderEvents, by: users.name })
      .from(orderEvents)
      .innerJoin(users, eq(users.id, orderEvents.createdBy))
      .where(eq(orderEvents.orderId, id))
      .orderBy(asc(orderEvents.createdAt));
    const depositIds = await executor
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, id), eq(payments.purpose, 'DEPOSIT')));
    const o = row.order;
    return {
      ...summary!,
      address: o.address,
      city: o.city,
      note: o.note,
      lines,
      events: events.map((e) => ({
        id: e.event.id,
        from: e.event.fromStatus,
        to: e.event.toStatus,
        note: e.event.note,
        by: e.by,
        at: e.event.createdAt.toISOString(),
      })),
      deposits: await this.payments.byIds(
        executor,
        depositIds.map((d) => d.id),
      ),
      sale: o.saleId ? { id: o.saleId, number: row.saleNumber ?? '' } : null,
      cancelReason: o.cancelReason,
    };
  }

  async list(query: z.output<typeof orderListQuerySchema>): Promise<Page<OrderSummary>> {
    const where: SQL[] = [];
    if (query.status) where.push(eq(orders.status, query.status));
    if (query.open) where.push(inArray(orders.status, [...OPEN_ORDER_STATUSES]));
    if (query.source) where.push(eq(orders.source, query.source));
    if (query.courierId) where.push(eq(orders.courierId, query.courierId));
    if (query.customerId) where.push(eq(orders.customerId, query.customerId));
    if (query.unsettled)
      where.push(
        eq(orders.status, 'OUT'),
        sql`${orders.cod} > coalesce((select sum(l.amount) from courier_settlement_lines l where l.order_id = ${sql.raw('orders.id')}), 0)`,
      );
    if (query.q) {
      const like = `%${query.q}%`;
      where.push(
        or(
          ilike(orders.number, like),
          ilike(customers.name, like),
          ilike(customers.phone, like),
          ilike(orders.city, like),
        )!,
      );
    }
    const condition = where.length ? and(...where) : undefined;
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(condition);
    const rows = await this.db
      .select({ order: orders })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(condition)
      .orderBy(query.open ? asc(orders.createdAt) : desc(orders.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return {
      items: await this.summaries(
        this.db,
        rows.map((r) => r.order),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Lines of several orders gathered for picking, by shelf location. */
  async pickList(ids: string[]) {
    const rows = await this.db
      .select({ order: orders })
      .from(orders)
      .where(inArray(orders.id, ids));
    const result = [];
    for (const r of rows) {
      const lines = await this.lineViews(this.db, r.order.id, r.order.status);
      for (const l of lines)
        result.push({ ...l, orderId: r.order.id, orderNumber: r.order.number });
    }
    return result.sort(
      (a, b) => (a.location ?? '￿').localeCompare(b.location ?? '￿') || a.sku.localeCompare(b.sku),
    );
  }

  // ------------------------------------------------------------------ internals

  private async step(
    actor: Actor,
    id: string,
    from: OrderStatus | OrderStatus[],
    to: OrderStatus,
    note: string | null,
    work?: (tx: Transaction, order: OrderRow) => Promise<void>,
  ): Promise<OrderView> {
    await inTransaction(this.db, (tx) =>
      this.stepWithin(tx, actor, id, from, to, note, async (order) => {
        await work?.(tx, order);
      }),
    );
    return this.get(id);
  }

  /**
   * Applies a step only from its own status. Already in the target status: nothing happens
   * (the second click of a double click). Anywhere else: refused.
   */
  private async stepWithin(
    tx: Transaction,
    actor: Actor,
    id: string,
    from: OrderStatus | OrderStatus[],
    to: OrderStatus,
    note: string | null,
    work: (order: OrderRow) => Promise<Partial<typeof orders.$inferInsert> | void>,
  ): Promise<void> {
    const order = await this.lock(tx, id);
    if (order.status === to) return;
    const allowed = Array.isArray(from) ? from : [from];
    if (!allowed.includes(order.status))
      throw conflict(ORDER_ERRORS.WRONG_STATUS, `The order is ${order.status}`, {
        status: order.status,
      });
    const extra = (await work(order)) ?? {};
    await tx
      .update(orders)
      .set({ ...extra, status: to, version: sql`${orders.version} + 1`, updatedAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, order.status)));
    await this.event(tx, id, order.status, to, actor, note);
    await this.audit.record(tx, {
      userId: actor.id,
      action: `ORDER_${to}`,
      entity: 'order',
      entityId: id,
      oldValue: { status: order.status },
      newValue: { status: to },
      reason: note,
    });
  }

  private async handOver(
    actor: Actor,
    id: string,
    idempotencyKey: string,
    to: 'OUT' | 'COLLECTED',
    note: string | null,
    prepare: (
      tx: Transaction,
      order: OrderRow,
    ) => Promise<{
      courierId: string | null;
      shiftId?: string;
      payments: z.output<typeof collectOrderSchema>['payments'];
      overpayment: 'CHANGE' | 'CREDIT';
    }>,
  ): Promise<OrderView> {
    await this.idempotency.run(`orders.${to}`, idempotencyKey, actor.id, { id, to }, (tx) =>
      this.stepWithin(tx, actor, id, 'READY', to, note, async (order) => {
        const how = await prepare(tx, order);
        const lines = await this.linesOf(tx, id);
        await this.releaseLines(tx, lines);
        const catalogue = await this.sales.catalogueRows(
          tx,
          lines.map((l) => l.itemId),
        );
        // Today's price, less the quote's difference when it went up since the order was taken.
        const saleLines = lines.map((l) => {
          const price = catalogue.get(l.itemId)?.price ?? l.unitPrice;
          const rise =
            compareMoney(price, l.unitPrice) > 0 ? addMoney(price, neg(l.unitPrice)) : ZERO;
          return {
            itemId: l.itemId,
            quantity: l.quantity,
            unitPrice: price,
            discount: addMoney(l.discount, multiplyMoney(rise, l.quantity)),
            giveaway: false,
          };
        });
        const total = addMoney(
          ZERO,
          ...saleLines.map((l) =>
            addMoney(multiplyMoney(l.unitPrice, l.quantity), neg(l.discount)),
          ),
        );
        // The deposit (held as credit) pays first, as far as the credit is still there.
        const deposits = await this.depositsOf(tx, [id]);
        const balance = (await this.customers.balances(tx, [order.customerId])).get(
          order.customerId,
        )!;
        const fromCredit = minMoney(
          minMoney(
            deposits.get(id) ?? ZERO,
            compareMoney(balance.credit, 0) > 0 ? balance.credit : ZERO,
          ),
          total,
        );
        const defaultCurrency = await this.currencies.defaultCode(tx);
        const paidNow = how.payments.length
          ? addMoney(
              ZERO,
              ...(await Promise.all(
                how.payments.map(
                  async (p) => (await this.payments.price(tx, p, defaultCurrency)).amountDefault,
                ),
              )),
            )
          : ZERO;
        const due = addMoney(total, neg(fromCredit));
        const cod = how.courierId ? due : ZERO;
        const created = await this.sales.checkoutWithin(
          tx,
          actor,
          {
            idempotencyKey: randomUUID(),
            shiftId: how.shiftId,
            customerId: order.customerId,
            source: order.source,
            mode: 'TAKEN',
            lines: saleLines,
            cartDiscount: ZERO,
            payments: [
              ...(compareMoney(fromCredit, 0) > 0
                ? [
                    {
                      method: 'STORE_CREDIT' as const,
                      currency: defaultCurrency,
                      amount: fromCredit,
                    },
                  ]
                : []),
              ...how.payments,
            ],
            overpayment: how.overpayment,
            confirmDuplicate: true,
            giftReceipt: false,
            note: order.number,
          },
          {
            ...(how.courierId && { courier: { id: how.courierId, amount: cod } }),
            // The only discount here is the quote kept after a price rise: shop policy.
            discountApproved: true,
          },
        );
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'ORDER_HANDOVER',
          entity: 'order',
          entityId: id,
          newValue: { saleId: created.id, total, fromCredit, paidNow, cod },
        });
        return { saleId: created.id, courierId: how.courierId ?? order.courierId, cod };
      }).then(() => ({ id })),
    );
    return this.get(id);
  }

  private async lock(tx: Transaction, id: string): Promise<OrderRow> {
    const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!row) throw notFound('Order');
    return row;
  }

  private async bump(tx: Transaction, order: OrderRow) {
    await tx
      .update(orders)
      .set({ version: order.version + 1, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  }

  private async event(
    tx: Transaction,
    orderId: string,
    from: OrderStatus | null,
    to: OrderStatus,
    actor: Actor,
    note: string | null | undefined,
  ) {
    await tx.insert(orderEvents).values({
      orderId,
      fromStatus: from,
      toStatus: to,
      note: note ?? null,
      createdBy: actor.id,
    });
  }

  private async requireCourier(executor: Executor, id: string) {
    const [row] = await executor.select().from(couriers).where(eq(couriers.id, id));
    if (!row) throw notFound('Courier');
    if (!row.isActive) throw conflict(ORDER_ERRORS.COURIER_INACTIVE, 'Delivery company inactive');
    return row;
  }

  /** Server prices; a line already on the order keeps its quote. */
  private async price(
    tx: Transaction,
    lines: LineInput[],
    existing: (typeof orderLines.$inferSelect)[] = [],
  ) {
    const catalogue = await this.sales.catalogueRows(
      tx,
      lines.map((l) => l.itemId),
    );
    const notSellable = lines
      .filter((l) => !catalogue.get(l.itemId)?.sellable)
      .map((l) => l.itemId);
    if (notSellable.length)
      throw conflict(ORDER_ERRORS.ITEM_NOT_SELLABLE, 'Some items cannot be sold', {
        items: notSellable,
      });
    const quoted = new Map(existing.map((l) => [l.itemId, l.unitPrice]));
    return lines.map((l) => {
      const price = quoted.get(l.itemId) ?? catalogue.get(l.itemId)!.price;
      if (compareMoney(l.discount, multiplyMoney(price, l.quantity)) > 0)
        throw badRequest(ORDER_ERRORS.DISCOUNT_TOO_LARGE, 'Discount above the line value', {
          itemId: l.itemId,
        });
      return { ...l, price };
    });
  }

  private async assertNotDuplicate(tx: Transaction, customerId: string, lines: LineInput[]) {
    const signature = (rows: { itemId: string; quantity: number }[]) =>
      rows
        .map((r) => `${r.itemId}:${r.quantity}`)
        .sort()
        .join(',');
    const today = await tx
      .select({ id: orders.id, number: orders.number })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, customerId),
          sql`${orders.status} <> 'CANCELLED'`,
          sql`(${orders.createdAt} at time zone 'Asia/Jerusalem')::date = (now() at time zone 'Asia/Jerusalem')::date`,
        ),
      );
    const mine = signature(lines);
    for (const o of today) {
      const theirs = await tx
        .select({ itemId: orderLines.itemId, quantity: orderLines.quantity })
        .from(orderLines)
        .where(eq(orderLines.orderId, o.id));
      if (signature(theirs) === mine)
        throw conflict(ORDER_ERRORS.POSSIBLE_DUPLICATE, 'The same order was taken today', {
          orderId: o.id,
          number: o.number,
        });
    }
  }

  private async linesOf(executor: Executor, orderId: string) {
    return executor
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId))
      .orderBy(asc(orderLines.position));
  }

  /** Reserves what each line still lacks, as far as stock allows; the rest shows as short. */
  private async reserveLines(tx: Transaction, lines: (typeof orderLines.$inferSelect)[]) {
    if (!lines.length) return;
    const balances = await this.stock.lock(
      tx,
      lines.map((l) => l.itemId),
    );
    const free = new Map([...balances.values()].map((b) => [b.itemId, b.onHand - b.reserved]));
    const wanted: { itemId: string; quantity: number }[] = [];
    for (const l of lines) {
      const missing = l.quantity - l.reserved;
      const take = Math.max(0, Math.min(missing, free.get(l.itemId) ?? 0));
      if (take <= 0) continue;
      free.set(l.itemId, (free.get(l.itemId) ?? 0) - take);
      wanted.push({ itemId: l.itemId, quantity: take });
      await tx
        .update(orderLines)
        .set({ reserved: l.reserved + take })
        .where(eq(orderLines.id, l.id));
    }
    if (wanted.length) await this.stock.reserve(tx, wanted);
  }

  /** Gives back what the lines hold; the lines keep their figures as a record. */
  private async releaseLines(tx: Transaction, lines: (typeof orderLines.$inferSelect)[]) {
    const held = lines.filter((l) => l.reserved > 0);
    if (held.length)
      await this.stock.release(
        tx,
        held.map((l) => ({ itemId: l.itemId, quantity: l.reserved })),
      );
  }

  private async depositsOf(executor: Executor, ids: string[]) {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const rows = await executor
      .select({
        orderId: payments.orderId,
        total: sql<string>`sum(case when ${payments.direction} = 'IN' then ${payments.amountDefault} else -${payments.amountDefault} end)::text`,
      })
      .from(payments)
      .where(and(inArray(payments.orderId, ids), eq(payments.purpose, 'DEPOSIT')))
      .groupBy(payments.orderId);
    for (const r of rows) map.set(r.orderId!, addMoney(r.total));
    return map;
  }

  private async settledOf(executor: Executor, ids: string[]) {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const rows = await executor
      .select({
        orderId: courierSettlementLines.orderId,
        total: sql<string>`sum(${courierSettlementLines.amount})::text`,
      })
      .from(courierSettlementLines)
      .where(inArray(courierSettlementLines.orderId, ids))
      .groupBy(courierSettlementLines.orderId);
    for (const r of rows) map.set(r.orderId, addMoney(r.total));
    return map;
  }

  private async summaries(executor: Executor, rows: OrderRow[]): Promise<OrderSummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const totals = await executor
      .select({
        orderId: orderLines.orderId,
        total: sql<string>`sum(${orderLines.unitPrice} * ${orderLines.quantity} - ${orderLines.discount})::text`,
        count: sql<number>`sum(${orderLines.quantity})::int`,
        short: sql<number>`count(*) filter (where ${orderLines.reserved} < ${orderLines.quantity})::int`,
        images: sql<string[]>`array_remove(array_agg((
          select coalesce(
            (select i.filename from product_images i where i.item_id = ${sql.raw('order_lines.item_id')} and i.removed_at is null order by i.sort_order limit 1),
            (select i.filename from product_images i join items it on it.product_id = i.product_id where it.id = ${sql.raw('order_lines.item_id')} and i.removed_at is null order by i.is_primary desc, i.sort_order limit 1))
        ) order by ${sql.raw('order_lines.position')}), null)`,
      })
      .from(orderLines)
      .where(inArray(orderLines.orderId, ids))
      .groupBy(orderLines.orderId);
    const byOrder = new Map(totals.map((t) => [t.orderId, t]));
    const people = await executor
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        city: customers.city,
      })
      .from(customers)
      .where(inArray(customers.id, [...new Set(rows.map((r) => r.customerId))]));
    const personById = new Map(people.map((p) => [p.id, p]));
    const courierIds = [...new Set(rows.map((r) => r.courierId).filter((c): c is string => !!c))];
    const companies = courierIds.length
      ? await executor
          .select({ id: couriers.id, name: couriers.name })
          .from(couriers)
          .where(inArray(couriers.id, courierIds))
      : [];
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const deposits = await this.depositsOf(executor, ids);
    const settled = await this.settledOf(executor, ids);
    return rows.map((o) => {
      const t = byOrder.get(o.id);
      const person = personById.get(o.customerId)!;
      return {
        id: o.id,
        number: o.number,
        source: o.source,
        status: o.status,
        delivery: o.delivery,
        customer: { ...person, city: o.city ?? person.city },
        courier: o.courierId ? (companyById.get(o.courierId) ?? null) : null,
        total: addMoney(t?.total ?? ZERO),
        deposit: deposits.get(o.id) ?? ZERO,
        cod: addMoney(o.cod),
        settled: settled.get(o.id) ?? ZERO,
        short: HELD_STATUSES.includes(o.status) ? (t?.short ?? 0) : 0,
        itemCount: t?.count ?? 0,
        images: (t?.images ?? []).slice(0, 6).map((f) => `/uploads/${f}-thumbnail.webp`),
        createdAt: o.createdAt.toISOString(),
        saleId: o.saleId,
        version: o.version,
      };
    });
  }

  private async lineViews(
    executor: Executor,
    orderId: string,
    status: OrderStatus,
  ): Promise<OrderLineView[]> {
    const lines = await this.linesOf(executor, orderId);
    if (!lines.length) return [];
    const catalogue = await this.sales.catalogueRows(
      executor,
      lines.map((l) => l.itemId),
    );
    const extra = await executor
      .select({
        itemId: items.id,
        location: items.location,
        onHand: itemBalances.onHand,
        reserved: itemBalances.reserved,
        image: sql<string | null>`coalesce(
          (select i.filename from product_images i where i.item_id = ${sql.raw('items.id')} and i.removed_at is null order by i.sort_order limit 1),
          (select i.filename from product_images i where i.product_id = ${sql.raw('items.product_id')} and i.removed_at is null order by i.is_primary desc, i.sort_order limit 1))`,
      })
      .from(items)
      .leftJoin(itemBalances, eq(itemBalances.itemId, items.id))
      .where(
        inArray(
          items.id,
          lines.map((l) => l.itemId),
        ),
      );
    const byItem = new Map(extra.map((e) => [e.itemId, e]));
    const holding = HELD_STATUSES.includes(status);
    return lines.map((l) => {
      const c = catalogue.get(l.itemId)!;
      const e = byItem.get(l.itemId);
      const free = (e?.onHand ?? 0) - (e?.reserved ?? 0);
      return {
        id: l.id,
        itemId: l.itemId,
        productId: c.productId,
        name: c.name as Translatable,
        variantLabel: c.variantLabel,
        sku: c.sku,
        imageUrl: e?.image ? `/uploads/${e.image}-thumbnail.webp` : null,
        location: e?.location ?? null,
        quantity: l.quantity,
        reserved: l.reserved,
        unitPrice: l.unitPrice,
        currentPrice: c.price,
        available: Math.max(0, free) + (holding ? l.reserved : 0),
        discount: l.discount,
        lineTotal: addMoney(multiplyMoney(l.unitPrice, l.quantity), neg(l.discount)),
      };
    });
  }
}
