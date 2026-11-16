import { Injectable } from '@nestjs/common';
import {
  addMoney,
  compareMoney,
  courierSchema,
  courierSettlementSchema,
  type CourierSettlementView,
  type CourierView,
  fromMinor,
  toMinor,
  updateCourierSchema,
} from '@organza/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
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
  courierSettlements,
  journalLines,
  orders,
  payments,
  users,
} from '../../../database/schema/index.js';
import {
  currentTransaction,
  type Database,
  type Executor,
  inTransaction,
} from '../../../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../../ledger/services/ledger.service.js';
import { SALES_ERRORS } from '../../sales/constants.js';
import { PaymentsService } from '../../sales/services/payments.service.js';
import { ShiftsService } from '../../sales/services/shifts.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';

export const COURIER_ERRORS = {
  OVER_SETTLED: 'COURIER_OVER_SETTLED',
  ORDER_NOT_THEIRS: 'COURIER_ORDER_NOT_THEIRS',
  ALLOCATION_ABOVE_PAID: 'COURIER_ALLOCATION_ABOVE_PAID',
} as const;

const ZERO = '0.00';
const neg = (amount: string) => fromMinor(-toMinor(amount));
const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);

/**
 * Delivery companies (proposal C7). Cash on delivery is money the company owes from the moment
 * the parcel leaves; a settlement is the company paying it, less its fee (an expense). What is
 * still owed is always the company's balance on COURIER_RECEIVABLES.
 */
@Injectable()
export class CouriersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly shifts: ShiftsService,
    private readonly currencies: CurrenciesService,
  ) {}

  async list(executor: Executor = this.db): Promise<CourierView[]> {
    const rows = await executor.select().from(couriers).orderBy(asc(couriers.name));
    return this.views(executor, rows);
  }

  async get(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const rows = await executor.select().from(couriers).where(eq(couriers.id, id));
    if (!rows.length) throw notFound('Courier');
    return (await this.views(executor, rows))[0]!;
  }

  async create(actor: Actor, input: z.output<typeof courierSchema>): Promise<CourierView> {
    const id = await inTransaction(this.db, async (tx) => {
      const [row] = await tx.insert(couriers).values(input).returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'COURIER_CREATE',
        entity: 'courier',
        entityId: row!.id,
        newValue: input,
      });
      return row!.id;
    });
    return this.get(id);
  }

  async update(
    actor: Actor,
    id: string,
    input: z.output<typeof updateCourierSchema>,
  ): Promise<CourierView> {
    await inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(couriers).where(eq(couriers.id, id)).for('update');
      if (!before) throw notFound('Courier');
      await tx.update(couriers).set(input).where(eq(couriers.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'COURIER_UPDATE',
        entity: 'courier',
        entityId: id,
        oldValue: before,
        newValue: input,
      });
    });
    return this.get(id);
  }

  /**
   * The company pays. The money and the fee clear its balance; the orders it covers are the
   * ones listed or, if none are, the oldest still open. Whatever it did not pay stays owed.
   */
  async settle(
    actor: Actor,
    courierId: string,
    input: z.output<typeof courierSettlementSchema>,
  ): Promise<CourierSettlementView> {
    const { result } = await this.idempotency.run(
      'couriers.settle',
      input.idempotencyKey,
      actor.id,
      { courierId, ...input },
      async (tx) => {
        const [courier] = await tx
          .select()
          .from(couriers)
          .where(eq(couriers.id, courierId))
          .for('update');
        if (!courier) throw notFound('Courier');
        if (input.method === 'CASH' && !input.shiftId)
          throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
        const shift = input.shiftId ? await this.shifts.requireOpen(tx, input.shiftId) : null;
        const today = await this.ledger.today(tx);
        const defaultCurrency = await this.currencies.defaultCode(tx);
        const covered = addMoney(input.received, input.fee);

        // What each order still lacks.
        const open = await tx
          .select({
            id: orders.id,
            cod: orders.cod,
            settled: sql<string>`coalesce((select sum(l.amount) from courier_settlement_lines l where l.order_id = ${sql.raw('orders.id')}), 0)::text`,
          })
          .from(orders)
          .where(and(eq(orders.courierId, courierId), eq(orders.status, 'OUT')))
          .orderBy(asc(orders.createdAt))
          .for('update');
        const lacking = new Map(open.map((o) => [o.id, addMoney(o.cod, neg(o.settled))]));
        const allocations: { orderId: string; amount: string }[] = [];
        if (input.orders?.length) {
          for (const a of input.orders) {
            const left = lacking.get(a.orderId);
            if (left === undefined)
              throw conflict(COURIER_ERRORS.ORDER_NOT_THEIRS, 'Not an open order of this company', {
                orderId: a.orderId,
              });
            if (compareMoney(a.amount, left) > 0)
              throw conflict(COURIER_ERRORS.OVER_SETTLED, 'More than the order still lacks', {
                orderId: a.orderId,
                left,
              });
            lacking.set(a.orderId, addMoney(left, neg(a.amount)));
            allocations.push(a);
          }
          const total = addMoney(ZERO, ...allocations.map((a) => a.amount));
          if (compareMoney(total, covered) > 0)
            throw badRequest(COURIER_ERRORS.ALLOCATION_ABOVE_PAID, 'Orders exceed the payment');
        } else {
          let left = covered;
          for (const o of open) {
            if (compareMoney(left, 0) <= 0) break;
            const take = minMoney(lacking.get(o.id)!, left);
            if (compareMoney(take, 0) <= 0) continue;
            allocations.push({ orderId: o.id, amount: take });
            left = addMoney(left, neg(take));
          }
        }

        const number = await this.documents.next(tx, 'CS');
        const party = { partyType: 'COURIER' as const, partyId: courierId };
        const payment =
          compareMoney(input.received, 0) > 0
            ? await this.payments.record(tx, {
                method: input.method,
                currency: defaultCurrency,
                amount: input.received,
                rate: '1',
                amountDefault: input.received,
                reference: input.reference ?? undefined,
                direction: 'IN',
                purpose: 'COURIER_SETTLEMENT',
                customerId: null,
                shiftId: shift?.id ?? null,
                takenBy: actor.id,
                businessDate: today,
                note: `${number} ${courier.name}`,
                counter: [credit('COURIER_RECEIVABLES', input.received, party)],
              })
            : null;
        const [row] = await tx
          .insert(courierSettlements)
          .values({
            number,
            courierId,
            paymentId: payment?.id ?? null,
            received: input.received,
            fee: input.fee,
            note: input.note,
            createdBy: actor.id,
          })
          .returning();
        if (compareMoney(input.fee, 0) > 0)
          await this.ledger.post(tx, {
            sourceType: 'courier_settlement',
            sourceId: row!.id,
            event: 'COURIER_FEE',
            createdBy: actor.id,
            entryDate: today,
            lines: [
              debit('OPERATING_EXPENSES', input.fee, { dimension: 'DELIVERY' }),
              credit('COURIER_RECEIVABLES', input.fee, party),
            ],
          });
        if (allocations.length)
          await tx
            .insert(courierSettlementLines)
            .values(allocations.map((a) => ({ settlementId: row!.id, ...a })));
        await this.audit.record(tx, {
          userId: actor.id,
          action: 'COURIER_SETTLE',
          entity: 'courier',
          entityId: courierId,
          newValue: { number, received: input.received, fee: input.fee, allocations },
        });
        return { id: row!.id };
      },
    );
    return this.settlement(result.id);
  }

  async settlement(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const [row] = await executor
      .select({
        s: courierSettlements,
        courierName: couriers.name,
        by: users.name,
        method: payments.method,
        reference: payments.reference,
      })
      .from(courierSettlements)
      .innerJoin(couriers, eq(couriers.id, courierSettlements.courierId))
      .innerJoin(users, eq(users.id, courierSettlements.createdBy))
      .leftJoin(payments, eq(payments.id, courierSettlements.paymentId))
      .where(eq(courierSettlements.id, id));
    if (!row) throw notFound('Settlement');
    return (await this.settlementViews(executor, [row]))[0]!;
  }

  async settlements(courierId: string): Promise<CourierSettlementView[]> {
    const rows = await this.db
      .select({
        s: courierSettlements,
        courierName: couriers.name,
        by: users.name,
        method: payments.method,
        reference: payments.reference,
      })
      .from(courierSettlements)
      .innerJoin(couriers, eq(couriers.id, courierSettlements.courierId))
      .innerJoin(users, eq(users.id, courierSettlements.createdBy))
      .leftJoin(payments, eq(payments.id, courierSettlements.paymentId))
      .where(eq(courierSettlements.courierId, courierId))
      .orderBy(desc(courierSettlements.createdAt))
      .limit(100);
    return this.settlementViews(this.db, rows);
  }

  private async settlementViews(
    executor: Executor,
    rows: {
      s: typeof courierSettlements.$inferSelect;
      courierName: string;
      by: string;
      method: string | null;
      reference: string | null;
    }[],
  ): Promise<CourierSettlementView[]> {
    if (!rows.length) return [];
    const lines = await executor
      .select({
        settlementId: courierSettlementLines.settlementId,
        orderId: courierSettlementLines.orderId,
        number: orders.number,
        amount: courierSettlementLines.amount,
      })
      .from(courierSettlementLines)
      .innerJoin(orders, eq(orders.id, courierSettlementLines.orderId))
      .where(
        inArray(
          courierSettlementLines.settlementId,
          rows.map((r) => r.s.id),
        ),
      )
      .orderBy(asc(orders.number));
    return rows.map((r) => ({
      id: r.s.id,
      number: r.s.number,
      courier: { id: r.s.courierId, name: r.courierName },
      method: r.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER',
      received: addMoney(r.s.received),
      fee: addMoney(r.s.fee),
      reference: r.reference,
      note: r.s.note,
      orders: lines
        .filter((l) => l.settlementId === r.s.id)
        .map((l) => ({ orderId: l.orderId, number: l.number, amount: addMoney(l.amount) })),
      createdAt: r.s.createdAt.toISOString(),
      createdBy: r.by,
    }));
  }

  private async views(
    executor: Executor,
    rows: (typeof couriers.$inferSelect)[],
  ): Promise<CourierView[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const balances = await executor
      .select({
        partyId: journalLines.partyId,
        total: sql<string>`sum(${journalLines.amount})::text`,
      })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.account, 'COURIER_RECEIVABLES'),
          eq(journalLines.partyType, 'COURIER'),
          inArray(journalLines.partyId, ids),
        ),
      )
      .groupBy(journalLines.partyId);
    const open = await executor
      .select({ courierId: orders.courierId, count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          inArray(orders.courierId, ids),
          eq(orders.status, 'OUT'),
          sql`${orders.cod} > coalesce((select sum(l.amount) from courier_settlement_lines l where l.order_id = ${sql.raw('orders.id')}), 0)`,
        ),
      )
      .groupBy(orders.courierId);
    const balance = new Map(balances.map((b) => [b.partyId, addMoney(b.total)]));
    const count = new Map(open.map((o) => [o.courierId, o.count]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      note: r.note,
      isActive: r.isActive,
      balance: balance.get(r.id) ?? ZERO,
      openOrders: count.get(r.id) ?? 0,
    }));
  }
}
