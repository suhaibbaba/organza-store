import { Injectable } from '@nestjs/common';
import {
  addMoney,
  compareMoney,
  fromMinor,
  type PaymentInput,
  type SupplierPaymentView,
  type SupplierStatementRow,
  type SupplierView,
  supplierListQuerySchema,
  supplierPaySchema,
  supplierSchema,
  toMinor,
  updateSupplierSchema,
} from '@organza/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  journalLines,
  payments,
  purchaseOrders,
  supplierAllocations,
  supplierCreditNotes,
  supplierReceipts,
  suppliers,
  users,
} from '../../../database/schema/index.js';
import {
  currentTransaction,
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../../ledger/services/ledger.service.js';
import { SALES_ERRORS } from '../../sales/constants.js';
import { PaymentsService } from '../../sales/services/payments.service.js';
import { ShiftsService } from '../../sales/services/shifts.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';

export const PURCHASING_ERRORS = {
  SUPPLIER_INACTIVE: 'SUPPLIER_INACTIVE',
  RECEIPT_NOT_THEIRS: 'RECEIPT_NOT_THEIRS',
  ALLOCATION_TOO_LARGE: 'SUPPLIER_ALLOCATION_TOO_LARGE',
  ALLOCATION_ABOVE_PAID: 'SUPPLIER_ALLOCATION_ABOVE_PAID',
  NOTHING_TO_REFUND: 'SUPPLIER_NOTHING_TO_REFUND',
  ITEM_UNKNOWN: 'ITEM_UNKNOWN',
  ORDER_NOT_OPEN: 'PURCHASE_ORDER_NOT_OPEN',
  ORDER_NOT_THEIRS: 'PURCHASE_ORDER_NOT_THEIRS',
  ORDER_HAS_RECEIPTS: 'PURCHASE_ORDER_HAS_RECEIPTS',
  RETURN_TOO_MANY: 'SUPPLIER_RETURN_TOO_MANY',
  PAY_NOT_ALLOWED: 'SUPPLIER_PAY_NOT_ALLOWED',
} as const;

const ZERO = '0.00';
export const neg = (amount: string) => fromMinor(-toMinor(amount));
const minMoney = (a: string, b: string) => (compareMoney(a, b) <= 0 ? a : b);

type PaymentPayload = z.output<typeof supplierPaySchema>['payment'];

/**
 * Suppliers (proposal C8): who they are, what the shop owes each (their balance on
 * SUPPLIER_PAYABLES), their statement and the money paid to them. Payments and credit notes
 * settle receipts through `supplier_allocations`; what is not allocated waits as credit and
 * is used on the next receipt.
 */
@Injectable()
export class SuppliersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly shifts: ShiftsService,
    private readonly currencies: CurrenciesService,
  ) {}

  // ------------------------------------------------------------------ suppliers

  async list(query: z.output<typeof supplierListQuerySchema>): Promise<SupplierView[]> {
    const q = query.q?.trim();
    const rows = await this.db
      .select()
      .from(suppliers)
      .where(
        and(
          query.active === undefined ? undefined : eq(suppliers.isActive, query.active),
          q
            ? sql`(${suppliers.name} ILIKE ${`%${q}%`} OR ${suppliers.phone} ILIKE ${`%${q}%`} OR ${suppliers.contactName} ILIKE ${`%${q}%`})`
            : undefined,
        ),
      )
      .orderBy(asc(suppliers.name));
    const views = await this.views(this.db, rows);
    return query.owed ? views.filter((v) => compareMoney(v.owed, 0) > 0) : views;
  }

  async get(id: string, executor: Executor = currentTransaction() ?? this.db) {
    const rows = await executor.select().from(suppliers).where(eq(suppliers.id, id));
    if (!rows.length) throw notFound('Supplier');
    return (await this.views(executor, rows))[0]!;
  }

  async create(actor: Actor, input: z.output<typeof supplierSchema>): Promise<SupplierView> {
    const id = await inTransaction(this.db, async (tx) => {
      const [row] = await tx.insert(suppliers).values(input).returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SUPPLIER_CREATE',
        entity: 'supplier',
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
    input: z.output<typeof updateSupplierSchema>,
  ): Promise<SupplierView> {
    await inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(suppliers).where(eq(suppliers.id, id)).for('update');
      if (!before) throw notFound('Supplier');
      await tx.update(suppliers).set(input).where(eq(suppliers.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SUPPLIER_UPDATE',
        entity: 'supplier',
        entityId: id,
        oldValue: before,
        newValue: input,
      });
    });
    return this.get(id);
  }

  /** Locks the supplier for a change to its balance. */
  async lock(tx: Transaction, id: string, activeOnly = false) {
    const [row] = await tx.select().from(suppliers).where(eq(suppliers.id, id)).for('update');
    if (!row) throw notFound('Supplier');
    if (activeOnly && !row.isActive)
      throw conflict(PURCHASING_ERRORS.SUPPLIER_INACTIVE, 'The supplier is inactive');
    return row;
  }

  // ------------------------------------------------------------------ allocations

  /** Receipts of the supplier that are not fully settled, oldest first, with what is open. */
  async openReceipts(executor: Executor, supplierId: string) {
    const rows = await executor
      .select({
        id: supplierReceipts.id,
        number: supplierReceipts.number,
        total: supplierReceipts.total,
        settled: sql<string>`coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = ${sql.raw('supplier_receipts.id')}), 0)::text`,
        createdAt: supplierReceipts.createdAt,
      })
      .from(supplierReceipts)
      .where(eq(supplierReceipts.supplierId, supplierId))
      .orderBy(asc(supplierReceipts.createdAt), asc(supplierReceipts.number));
    return rows
      .map((r) => ({ ...r, open: addMoney(r.total, neg(r.settled)) }))
      .filter((r) => compareMoney(r.open, 0) > 0);
  }

  /**
   * Money and credit notes not yet allocated to a receipt, oldest first, less what the supplier
   * has already paid back. This is what the shop has paid ahead.
   */
  async freeCredit(tx: Transaction, supplierId: string) {
    const free = await tx.execute<{
      kind: 'payment' | 'credit';
      id: string;
      free: string;
    }>(sql`
      select 'payment' as kind, p.id, (p.amount_default - coalesce(
               (select sum(a.amount) from supplier_allocations a where a.payment_id = p.id), 0))::text as free,
             p.taken_at as at
        from payments p
       where p.supplier_id = ${supplierId} and p.direction = 'OUT'
      union all
      select 'credit', c.id, (c.amount - coalesce(
               (select sum(a.amount) from supplier_allocations a where a.credit_note_id = c.id), 0))::text,
             c.created_at
        from supplier_credit_notes c
       where c.supplier_id = ${supplierId}
       order by at`);
    const [refunded] = await tx
      .select({ total: sql<string>`coalesce(sum(${payments.amountDefault}), 0)::text` })
      .from(payments)
      .where(and(eq(payments.supplierId, supplierId), eq(payments.direction, 'IN')));
    const sources = [...free].filter((r) => compareMoney(r.free, 0) > 0);
    const net = addMoney(ZERO, ...sources.map((s) => s.free), neg(refunded?.total ?? '0'));
    return { sources, net, pool: compareMoney(net, 0) > 0 ? net : ZERO };
  }

  /** Uses the supplier's waiting credit on its open receipts, oldest first. */
  async applyFreeCredit(tx: Transaction, supplierId: string) {
    const { sources, pool } = await this.freeCredit(tx, supplierId);
    let left = pool;
    if (compareMoney(left, 0) <= 0) return;
    const receipts = await this.openReceipts(tx, supplierId);
    const rows: (typeof supplierAllocations.$inferInsert)[] = [];
    let r = 0;
    let open = receipts[0]?.open ?? ZERO;
    for (const s of sources) {
      let free = minMoney(s.free, left);
      while (compareMoney(free, 0) > 0 && r < receipts.length) {
        const take = minMoney(free, open);
        rows.push({
          receiptId: receipts[r]!.id,
          amount: take,
          ...(s.kind === 'payment' ? { paymentId: s.id } : { creditNoteId: s.id }),
        });
        free = addMoney(free, neg(take));
        left = addMoney(left, neg(take));
        open = addMoney(open, neg(take));
        if (compareMoney(open, 0) <= 0) open = receipts[++r]?.open ?? ZERO;
      }
      if (compareMoney(left, 0) <= 0 || r >= receipts.length) break;
    }
    if (rows.length) await tx.insert(supplierAllocations).values(rows);
  }

  /**
   * Allocates a payment or credit note: to the receipts listed (each within what it lacks), or
   * oldest open first. Returns the allocations made; the rest waits as credit.
   */
  async allocate(
    tx: Transaction,
    supplierId: string,
    source: { paymentId: string } | { creditNoteId: string },
    amount: string,
    listed?: { receiptId: string; amount: string }[],
  ) {
    const open = await this.openReceipts(tx, supplierId);
    const lacking = new Map(open.map((o) => [o.id, o.open]));
    const rows: { receiptId: string; amount: string }[] = [];
    if (listed?.length) {
      for (const a of listed) {
        const left = lacking.get(a.receiptId);
        if (left === undefined)
          throw conflict(
            PURCHASING_ERRORS.RECEIPT_NOT_THEIRS,
            'Not an open receipt of the supplier',
            {
              receiptId: a.receiptId,
            },
          );
        if (compareMoney(a.amount, left) > 0)
          throw conflict(PURCHASING_ERRORS.ALLOCATION_TOO_LARGE, 'More than the receipt lacks', {
            receiptId: a.receiptId,
            left,
          });
        lacking.set(a.receiptId, addMoney(left, neg(a.amount)));
        rows.push(a);
      }
      if (compareMoney(addMoney(ZERO, ...rows.map((a) => a.amount)), amount) > 0)
        throw badRequest(PURCHASING_ERRORS.ALLOCATION_ABOVE_PAID, 'Receipts exceed the amount');
    } else {
      let left = amount;
      for (const o of open) {
        if (compareMoney(left, 0) <= 0) break;
        const take = minMoney(o.open, left);
        rows.push({ receiptId: o.id, amount: take });
        left = addMoney(left, neg(take));
      }
    }
    if (rows.length)
      await tx.insert(supplierAllocations).values(rows.map((r) => ({ ...r, ...source })));
    return rows;
  }

  // ------------------------------------------------------------------ payments

  /** Records money to (OUT) or from (IN) a supplier and posts it against SUPPLIER_PAYABLES. */
  async recordPayment(
    tx: Transaction,
    actor: Actor,
    supplier: { id: string; name: string },
    input: {
      direction: 'IN' | 'OUT';
      payment: PaymentPayload;
      shiftId?: string;
      note?: string | null;
      label: string;
    },
  ) {
    const { payment } = input;
    if (payment.method === 'CASH' && !input.shiftId)
      throw badRequest(SALES_ERRORS.SHIFT_REQUIRED, 'Open a shift first');
    const shift =
      payment.method === 'CASH' && input.shiftId
        ? await this.shifts.requireOpen(tx, input.shiftId)
        : null;
    const defaultCurrency = await this.currencies.defaultCode(tx);
    const priced = await this.payments.price(
      tx,
      { ...payment, method: 'CARD' } as unknown as PaymentInput,
      defaultCurrency,
    );
    const party = { partyType: 'SUPPLIER' as const, partyId: supplier.id };
    const row = await this.payments.record(tx, {
      ...priced,
      method: payment.method,
      reference: payment.reference ?? undefined,
      direction: input.direction,
      purpose: 'SUPPLIER_PAYMENT',
      customerId: null,
      supplierId: supplier.id,
      shiftId: shift?.id ?? null,
      takenBy: actor.id,
      businessDate: await this.ledger.today(tx),
      note: input.note ?? `${input.label} ${supplier.name}`,
      counter: [
        input.direction === 'OUT'
          ? debit('SUPPLIER_PAYABLES', priced.amountDefault, party)
          : credit('SUPPLIER_PAYABLES', priced.amountDefault, party),
      ],
    });
    return row;
  }

  /** Pays a supplier (allocated to receipts), or records money the supplier paid back. */
  async pay(
    actor: Actor,
    supplierId: string,
    input: z.output<typeof supplierPaySchema>,
  ): Promise<SupplierPaymentView> {
    const { result } = await this.idempotency.run(
      'suppliers.pay',
      input.idempotencyKey,
      actor.id,
      { supplierId, ...input },
      async (tx) => {
        const supplier = await this.lock(tx, supplierId);
        const row = await this.recordPayment(tx, actor, supplier, {
          direction: input.direction,
          payment: input.payment,
          shiftId: input.shiftId,
          note: input.note,
          label: input.direction === 'OUT' ? 'Supplier payment' : 'Supplier refund',
        });
        if (input.direction === 'OUT') {
          await this.allocate(
            tx,
            supplierId,
            { paymentId: row.id },
            row.amountDefault,
            input.allocations,
          );
        } else {
          // A refund can only return what the shop paid ahead.
          const { net } = await this.freeCredit(tx, supplierId);
          if (compareMoney(net, 0) < 0)
            throw conflict(
              PURCHASING_ERRORS.NOTHING_TO_REFUND,
              'More than the supplier owes back',
              {
                available: addMoney(net, row.amountDefault),
              },
            );
        }
        await this.audit.record(tx, {
          userId: actor.id,
          action: input.direction === 'OUT' ? 'SUPPLIER_PAY' : 'SUPPLIER_REFUND',
          entity: 'supplier',
          entityId: supplierId,
          newValue: { number: row.number, amount: row.amountDefault, method: row.method },
        });
        return { id: row.id };
      },
    );
    return (await this.paymentViews(this.db, { ids: [result.id] }))[0]!;
  }

  async paymentsOf(supplierId: string): Promise<SupplierPaymentView[]> {
    return this.paymentViews(this.db, { supplierId });
  }

  private async paymentViews(
    executor: Executor,
    filter: { ids: string[] } | { supplierId: string },
  ): Promise<SupplierPaymentView[]> {
    const rows = await executor
      .select({ p: payments, by: users.name })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.takenBy))
      .where(
        'ids' in filter
          ? inArray(payments.id, filter.ids)
          : eq(payments.supplierId, filter.supplierId),
      )
      .orderBy(desc(payments.takenAt))
      .limit(200);
    if (!rows.length) return [];
    const allocations = await executor
      .select({
        paymentId: supplierAllocations.paymentId,
        receiptId: supplierAllocations.receiptId,
        number: supplierReceipts.number,
        amount: supplierAllocations.amount,
      })
      .from(supplierAllocations)
      .innerJoin(supplierReceipts, eq(supplierReceipts.id, supplierAllocations.receiptId))
      .where(
        inArray(
          supplierAllocations.paymentId,
          rows.map((r) => r.p.id),
        ),
      )
      .orderBy(asc(supplierReceipts.number));
    return rows.map(({ p, by }) => ({
      id: p.id,
      number: p.number,
      direction: p.direction,
      method: p.method as SupplierPaymentView['method'],
      currency: p.currency,
      amount: addMoney(p.amount),
      rate: p.rate,
      amountDefault: addMoney(p.amountDefault),
      reference: p.reference,
      note: p.note,
      allocations: allocations
        .filter((a) => a.paymentId === p.id)
        .map((a) => ({ receiptId: a.receiptId, number: a.number, amount: addMoney(a.amount) })),
      takenAt: p.takenAt.toISOString(),
      takenBy: by,
    }));
  }

  // ------------------------------------------------------------------ statement

  /** Every document that moved the supplier's balance, oldest first, with a running balance. */
  async statement(supplierId: string): Promise<SupplierStatementRow[]> {
    await this.get(supplierId);
    const [receipts, notes, money] = await Promise.all([
      this.db
        .select({
          id: supplierReceipts.id,
          number: supplierReceipts.number,
          amount: supplierReceipts.total,
          at: supplierReceipts.createdAt,
        })
        .from(supplierReceipts)
        .where(eq(supplierReceipts.supplierId, supplierId)),
      this.db
        .select({
          id: supplierCreditNotes.id,
          number: supplierCreditNotes.number,
          amount: supplierCreditNotes.amount,
          at: supplierCreditNotes.createdAt,
        })
        .from(supplierCreditNotes)
        .where(eq(supplierCreditNotes.supplierId, supplierId)),
      this.db
        .select({
          id: payments.id,
          number: payments.number,
          amount: payments.amountDefault,
          direction: payments.direction,
          at: payments.takenAt,
        })
        .from(payments)
        .where(eq(payments.supplierId, supplierId)),
    ]);
    const rows = [
      ...receipts.map((r) => ({ ...r, kind: 'RECEIPT' as const, up: true })),
      ...notes.map((r) => ({ ...r, kind: 'CREDIT_NOTE' as const, up: false })),
      ...money.map((r) => ({
        ...r,
        kind: r.direction === 'OUT' ? ('PAYMENT' as const) : ('REFUND' as const),
        up: r.direction === 'IN',
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime() || a.number.localeCompare(b.number));
    let balance = ZERO;
    return rows.map((r) => {
      balance = addMoney(balance, r.up ? r.amount : neg(r.amount));
      return {
        date: r.at.toISOString(),
        kind: r.kind,
        number: r.number,
        documentId: r.id,
        debit: r.up ? addMoney(r.amount) : ZERO,
        credit: r.up ? ZERO : addMoney(r.amount),
        balance,
      };
    });
  }

  // ------------------------------------------------------------------ views

  private async views(
    executor: Executor,
    rows: (typeof suppliers.$inferSelect)[],
  ): Promise<SupplierView[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [balances, receipts, orders] = await Promise.all([
      executor
        .select({
          partyId: journalLines.partyId,
          total: sql<string>`sum(${journalLines.amount})::text`,
        })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.account, 'SUPPLIER_PAYABLES'),
            eq(journalLines.partyType, 'SUPPLIER'),
            inArray(journalLines.partyId, ids),
          ),
        )
        .groupBy(journalLines.partyId),
      executor
        .select({ supplierId: supplierReceipts.supplierId, count: sql<number>`count(*)::int` })
        .from(supplierReceipts)
        .where(
          and(
            inArray(supplierReceipts.supplierId, ids),
            sql`${supplierReceipts.total} > coalesce((select sum(a.amount) from supplier_allocations a where a.receipt_id = ${sql.raw('supplier_receipts.id')}), 0)`,
          ),
        )
        .groupBy(supplierReceipts.supplierId),
      executor
        .select({ supplierId: purchaseOrders.supplierId, count: sql<number>`count(*)::int` })
        .from(purchaseOrders)
        .where(and(inArray(purchaseOrders.supplierId, ids), eq(purchaseOrders.status, 'OPEN')))
        .groupBy(purchaseOrders.supplierId),
    ]);
    // A liability: credits are negative, so what is owed is the negated sum.
    const owed = new Map(balances.map((b) => [b.partyId, neg(addMoney(b.total))]));
    const openReceipts = new Map(receipts.map((r) => [r.supplierId, r.count]));
    const openOrders = new Map(orders.map((r) => [r.supplierId, r.count]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      contactName: r.contactName,
      phone: r.phone,
      address: r.address,
      note: r.note,
      isActive: r.isActive,
      owed: owed.get(r.id) ?? ZERO,
      openReceipts: openReceipts.get(r.id) ?? 0,
      openOrders: openOrders.get(r.id) ?? 0,
    }));
  }
}
