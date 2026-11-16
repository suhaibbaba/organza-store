import { Injectable } from '@nestjs/common';
import {
  addMoney,
  type CashMovementView,
  type closeShiftSchema,
  compareMoney,
  type countShiftSchema,
  type CurrencyReconciliation,
  type cashMovementInputSchema,
  type ExpectedLine,
  fromMinor,
  multiplyMoney,
  type openShiftSchema,
  type PaymentMethod,
  type RegisterView,
  roleCan,
  type ShiftView,
  toMinor,
} from '@organza/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, forbidden, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { DocumentsService } from '../../../common/services/documents.service.js';
import { IdempotencyService } from '../../../common/services/idempotency.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  cashMovements,
  payments,
  registers,
  sales,
  shiftCounts,
  shifts,
  users,
} from '../../../database/schema/index.js';
import {
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { credit, debit, LedgerService } from '../../ledger/services/ledger.service.js';
import { CurrenciesService } from '../../settings/services/currencies.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { SALES_ERRORS } from '../constants.js';

type Shift = typeof shifts.$inferSelect;

/**
 * Tills and shifts (proposal C10). The expected cash is derived from payments and drawer
 * movements, per currency, and is never returned before the blind count is in.
 */
@Injectable()
export class ShiftsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly idempotency: IdempotencyService,
    private readonly ledger: LedgerService,
    private readonly currencies: CurrenciesService,
    private readonly settings: SettingsService,
  ) {}

  // ------------------------------------------------------------ registers

  async registers(): Promise<RegisterView[]> {
    const rows = await this.db
      .select({
        register: registers,
        openId: shifts.id,
        openNumber: shifts.number,
        openedBy: users.name,
        openedAt: shifts.openedAt,
        pending: sql<number>`(select count(*)::int from shifts s where s.register_id = ${sql.raw('registers.id')} and s.status = 'LEFT_OPEN')`,
        counted: sql<
          string | null
        >`(select s.id from shifts s where s.register_id = ${sql.raw('registers.id')} and s.status = 'COUNTED' order by s.opened_at desc limit 1)`,
      })
      .from(registers)
      .leftJoin(shifts, and(eq(shifts.registerId, registers.id), eq(shifts.status, 'OPEN')))
      .leftJoin(users, eq(users.id, shifts.openedBy))
      .orderBy(asc(registers.createdAt));
    return rows.map((r) => ({
      id: r.register.id,
      name: r.register.name,
      isActive: r.register.isActive,
      openShift: r.openId
        ? {
            id: r.openId,
            number: r.openNumber!,
            openedBy: r.openedBy!,
            openedAt: r.openedAt!.toISOString(),
          }
        : null,
      pendingCounts: r.pending,
      countedShiftId: r.counted,
    }));
  }

  async saveRegister(actor: Actor, id: string | null, name: string, isActive = true) {
    await inTransaction(this.db, async (tx) => {
      const [row] = id
        ? await tx.update(registers).set({ name, isActive }).where(eq(registers.id, id)).returning()
        : await tx.insert(registers).values({ name }).returning();
      if (!row) throw notFound('Register');
      await this.audit.record(tx, {
        userId: actor.id,
        action: id ? 'REGISTER_UPDATE' : 'REGISTER_CREATE',
        entity: 'register',
        entityId: row.id,
        newValue: row,
      });
    });
    return this.registers();
  }

  // ------------------------------------------------------------ open

  async open(actor: Actor, input: z.output<typeof openShiftSchema>): Promise<ShiftView> {
    const id = await inTransaction(this.db, async (tx) => {
      const [register] = await tx
        .select()
        .from(registers)
        .where(eq(registers.id, input.registerId))
        .for('update');
      if (!register) throw notFound('Register');
      if (!register.isActive) throw conflict(SALES_ERRORS.REGISTER_INACTIVE, 'Till is not in use');
      const today = await this.ledger.today(tx);
      const [open] = await tx
        .select()
        .from(shifts)
        .where(and(eq(shifts.registerId, register.id), eq(shifts.status, 'OPEN')));
      if (open) {
        if (open.businessDate >= today) {
          throw conflict(SALES_ERRORS.SHIFT_ALREADY_OPEN, 'This till already has an open shift', {
            shiftId: open.id,
          });
        }
        // Left open overnight: it stops taking sales and stays listed until it is counted.
        await tx.update(shifts).set({ status: 'LEFT_OPEN' }).where(eq(shifts.id, open.id));
      }

      const defaultCurrency = await this.currencies.defaultCode(tx);
      const left = await this.leftInDrawer(tx, register.id);
      const firstShift = left === null;
      const counted = new Map(input.float.map((f) => [f.currency, f]));
      const all = new Set([...counted.keys(), ...(left?.keys() ?? [])]);
      const differences: { currency: string; diff: string; rate: string }[] = [];
      for (const currency of all) {
        const diff = addMoney(
          counted.get(currency)?.amount ?? '0',
          fromMinor(-toMinor(left?.get(currency) ?? '0')),
        );
        if (compareMoney(diff, 0) !== 0)
          differences.push({
            currency,
            diff,
            rate: await this.currencies.currentRate(tx, currency),
          });
      }
      if (!firstShift && differences.length && !input.note) {
        throw badRequest(SALES_ERRORS.NOTE_REQUIRED, 'The float differs from what was left', {
          differences: differences.map(({ currency, diff }) => ({ currency, diff })),
        });
      }

      const number = await this.documents.next(tx, 'SHF');
      const [shift] = await tx
        .insert(shifts)
        .values({
          number,
          registerId: register.id,
          businessDate: today,
          openedBy: actor.id,
          openNote: input.note ?? null,
        })
        .returning();
      if (input.float.length) {
        await tx.insert(shiftCounts).values(
          input.float.map((f) => ({
            shiftId: shift!.id,
            kind: 'OPENING' as const,
            currency: f.currency,
            amount: f.amount,
            expected: left?.get(f.currency) ?? '0',
            denominations: f.denominations ?? null,
            countedBy: actor.id,
          })),
        );
      }
      // Cash in the drawer when the first shift opens enters the books as opening cash; after
      // that a float that differs from what was left is a drawer over/short.
      const lines = differences.flatMap(({ currency, diff, rate }) => {
        const value = currency === defaultCurrency ? diff : multiplyMoney(diff, rate);
        return [
          debit('CASH_DRAWER', value),
          credit(firstShift ? 'OPENING_BALANCES' : 'CASH_OVER_SHORT', value),
        ];
      });
      await this.ledger.post(tx, {
        sourceType: 'shift',
        sourceId: shift!.id,
        event: firstShift ? 'OPENING_CASH' : 'FLOAT_DIFFERENCE',
        createdBy: actor.id,
        entryDate: today,
        memo: input.note,
        lines,
      });
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SHIFT_OPEN',
        entity: 'shift',
        entityId: shift!.id,
        newValue: { number, registerId: register.id, float: input.float, differences },
        reason: input.note ?? null,
      });
      return shift!.id;
    });
    return this.get(actor, id);
  }

  /** What was left in the drawer by the register's last closed shift; null if none ever ran. */
  private async leftInDrawer(executor: Executor, registerId: string) {
    const [last] = await executor
      .select()
      .from(shifts)
      .where(and(eq(shifts.registerId, registerId), ne(shifts.status, 'OPEN')))
      .orderBy(desc(shifts.openedAt))
      .limit(1);
    if (!last) return null;
    if (last.status !== 'CLOSED') return new Map<string, string>();
    const counts = await this.finalCounts(executor, last.id);
    const drops = await executor
      .select({
        currency: cashMovements.currency,
        total: sql<string>`sum(${cashMovements.amount})::text`,
      })
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.shiftId, last.id),
          eq(cashMovements.type, 'DROP'),
          gte(cashMovements.createdAt, last.countedAt!),
          isNull(cashMovements.reversedAt),
        ),
      )
      .groupBy(cashMovements.currency);
    const left = new Map<string, string>();
    for (const [currency, amount] of counts) left.set(currency, amount);
    for (const d of drops)
      left.set(d.currency, addMoney(left.get(d.currency) ?? '0', fromMinor(-toMinor(d.total))));
    return left;
  }

  // ------------------------------------------------------------ during the shift

  /** For sales and payments: the shift must be open. Shared lock: closing waits for checkouts. */
  async requireOpen(tx: Transaction, shiftId: string): Promise<Shift> {
    const [shift] = await tx.select().from(shifts).where(eq(shifts.id, shiftId)).for('share');
    if (!shift) throw notFound('Shift');
    if (shift.status !== 'OPEN')
      throw conflict(SALES_ERRORS.SHIFT_NOT_OPEN, 'The shift is not open');
    return shift;
  }

  async current(registerId: string): Promise<{ id: string } | null> {
    const [open] = await this.db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.registerId, registerId), eq(shifts.status, 'OPEN')));
    return open ?? null;
  }

  async addMovement(
    actor: Actor,
    shiftId: string,
    input: z.output<typeof cashMovementInputSchema>,
  ) {
    await this.idempotency.run(
      'cash.movement',
      input.idempotencyKey,
      actor.id,
      { shiftId, ...input },
      async (tx) => {
        const shift = await this.requireOpen(tx, shiftId);
        if (input.type === 'EXPENSE') {
          const { expenseApprovalLimit } = await this.settings.get(tx);
          const defaultCurrency = await this.currencies.defaultCode(tx);
          const rate = await this.currencies.currentRate(tx, input.currency);
          const value =
            input.currency === defaultCurrency ? input.amount : multiplyMoney(input.amount, rate);
          if (
            compareMoney(value, expenseApprovalLimit) > 0 &&
            !roleCan(actor.role, 'shifts.signOff')
          )
            throw forbidden('EXPENSE_NEEDS_APPROVAL', 'Expenses above the limit need a manager');
        }
        if (input.type !== 'PAID_IN')
          await this.assertCashAvailable(tx, shift.id, input.currency, input.amount);
        return { id: await this.insertMovement(tx, actor, shift, input) };
      },
    );
    return this.get(actor, shiftId);
  }

  private async insertMovement(
    tx: Transaction,
    actor: Actor,
    shift: Shift,
    input: {
      type: 'PAID_IN' | 'DROP' | 'EXPENSE';
      currency: string;
      amount: string;
      counterpart: string;
      note?: string;
    },
  ) {
    const defaultCurrency = await this.currencies.defaultCode(tx);
    const rate = await this.currencies.currentRate(tx, input.currency);
    const value =
      input.currency === defaultCurrency ? input.amount : multiplyMoney(input.amount, rate);
    const number = await this.documents.next(tx, 'CSH');
    const [row] = await tx
      .insert(cashMovements)
      .values({
        number,
        shiftId: shift.id,
        type: input.type,
        currency: input.currency,
        amount: input.amount,
        rate,
        amountDefault: value,
        counterpart: input.counterpart,
        note: input.note ?? null,
        createdBy: actor.id,
      })
      .returning();
    const lines =
      input.type === 'PAID_IN'
        ? [debit('CASH_DRAWER', value), credit(input.counterpart as 'SAFE' | 'BANK', value)]
        : input.type === 'DROP'
          ? [debit(input.counterpart as 'SAFE' | 'BANK', value), credit('CASH_DRAWER', value)]
          : [
              debit('OPERATING_EXPENSES', value, { dimension: input.counterpart }),
              credit('CASH_DRAWER', value),
            ];
    await this.ledger.post(tx, {
      sourceType: 'cash_movement',
      sourceId: row!.id,
      event: `CASH_${input.type}`,
      createdBy: actor.id,
      memo: input.note,
      lines,
    });
    await this.audit.record(tx, {
      userId: actor.id,
      action: `CASH_${input.type}`,
      entity: 'cash_movement',
      entityId: row!.id,
      newValue: row,
      reason: input.note ?? null,
    });
    return row!.id;
  }

  /** A drawer cannot pay out cash it does not hold (by the system's own expectation). */
  private async assertCashAvailable(
    executor: Executor,
    shiftId: string,
    currency: string,
    amount: string,
  ) {
    const expected = (await this.expected(executor, shiftId)).get(currency)?.expected ?? '0.00';
    if (compareMoney(amount, expected) > 0)
      throw conflict(SALES_ERRORS.DROP_TOO_LARGE, 'More than the drawer holds', { currency });
  }

  // ------------------------------------------------------------ count and close

  /** The blind count: final once submitted; only now the expected figure becomes visible. */
  async count(
    actor: Actor,
    id: string,
    input: z.output<typeof countShiftSchema>,
  ): Promise<ShiftView> {
    await inTransaction(this.db, async (tx) => {
      const shift = await this.lockShift(tx, id);
      this.assertOwnerOrManager(actor, shift, 'shifts.closeOthers');
      if (shift.status !== 'OPEN' && shift.status !== 'LEFT_OPEN')
        throw conflict(SALES_ERRORS.SHIFT_NOT_OPEN, 'The shift is already counted');
      await this.insertCounts(tx, actor, shift.id, 'CLOSING', input);
      await tx
        .update(shifts)
        .set({ status: 'COUNTED', countedBy: actor.id, countedAt: new Date() })
        .where(eq(shifts.id, shift.id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SHIFT_COUNT',
        entity: 'shift',
        entityId: shift.id,
        newValue: input,
      });
    });
    return this.get(actor, id);
  }

  /** A manager's recount: both counts are kept; the latest is the one that closes the shift. */
  async recount(
    actor: Actor,
    id: string,
    input: z.output<typeof countShiftSchema>,
  ): Promise<ShiftView> {
    await inTransaction(this.db, async (tx) => {
      const shift = await this.lockShift(tx, id);
      if (shift.status !== 'COUNTED')
        throw conflict(SALES_ERRORS.SHIFT_NOT_COUNTED, 'Not counted yet');
      await this.insertCounts(tx, actor, shift.id, 'RECOUNT', input);
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SHIFT_RECOUNT',
        entity: 'shift',
        entityId: shift.id,
        newValue: input,
        reason: input.note ?? null,
      });
    });
    return this.get(actor, id);
  }

  private async insertCounts(
    tx: Transaction,
    actor: Actor,
    shiftId: string,
    kind: 'CLOSING' | 'RECOUNT',
    input: z.output<typeof countShiftSchema>,
  ) {
    const expected = await this.expected(tx, shiftId);
    const counted = new Map(input.counts.map((c) => [c.currency, c]));
    // Every currency the drawer should hold gets a row; one not counted counts as zero.
    const all = new Set([...counted.keys(), ...expected.keys()]);
    await tx.insert(shiftCounts).values(
      [...all].map((currency) => ({
        shiftId,
        kind,
        currency,
        amount: counted.get(currency)?.amount ?? '0.00',
        expected: expected.get(currency)?.expected ?? '0.00',
        denominations: counted.get(currency)?.denominations ?? null,
        countedBy: actor.id,
        note: input.note ?? null,
      })),
    );
  }

  async close(
    actor: Actor,
    id: string,
    input: z.output<typeof closeShiftSchema>,
  ): Promise<ShiftView> {
    await inTransaction(this.db, async (tx) => {
      const shift = await this.lockShift(tx, id);
      this.assertOwnerOrManager(actor, shift, 'shifts.closeOthers');
      if (shift.status !== 'COUNTED')
        throw conflict(SALES_ERRORS.SHIFT_NOT_COUNTED, 'Count the drawer first');
      const rec = await this.reconcile(tx, shift.id);
      const differences = rec.filter((r) => r.difference && compareMoney(r.difference, 0) !== 0);
      if (differences.length && !input.note)
        throw badRequest(SALES_ERRORS.NOTE_REQUIRED, 'A difference needs a note');
      for (const drop of input.drops) {
        const counted = rec.find((r) => r.currency === drop.currency)?.counted ?? '0.00';
        const already = input.drops
          .filter((d) => d.currency === drop.currency)
          .reduce((sum, d) => addMoney(sum, d.amount), '0.00');
        if (compareMoney(already, counted) > 0)
          throw badRequest(SALES_ERRORS.DROP_TOO_LARGE, 'More than was counted', {
            currency: drop.currency,
          });
      }
      const defaultCurrency = await this.currencies.defaultCode(tx);
      const lines = [];
      for (const d of differences) {
        const rate = await this.currencies.currentRate(tx, d.currency);
        const value =
          d.currency === defaultCurrency ? d.difference! : multiplyMoney(d.difference!, rate);
        lines.push(debit('CASH_DRAWER', value), credit('CASH_OVER_SHORT', value));
      }
      await this.ledger.post(tx, {
        sourceType: 'shift',
        sourceId: shift.id,
        event: 'DRAWER_DIFFERENCE',
        createdBy: actor.id,
        memo: input.note,
        lines,
      });
      for (const drop of input.drops)
        await this.insertMovement(tx, actor, shift, {
          type: 'DROP',
          counterpart: drop.to,
          ...drop,
        });
      await tx
        .update(shifts)
        .set({
          status: 'CLOSED',
          closedBy: actor.id,
          closedAt: new Date(),
          closeNote: input.note ?? null,
          hasDifference: differences.length > 0,
        })
        .where(eq(shifts.id, shift.id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SHIFT_CLOSE',
        entity: 'shift',
        entityId: shift.id,
        newValue: { reconciliation: rec, drops: input.drops },
        reason: input.note ?? null,
      });
    });
    return this.get(actor, id);
  }

  async signOff(actor: Actor, id: string, note: string): Promise<ShiftView> {
    await inTransaction(this.db, async (tx) => {
      const shift = await this.lockShift(tx, id);
      if (shift.status !== 'CLOSED' || !shift.hasDifference || shift.signedOffAt)
        throw conflict(SALES_ERRORS.NOT_SIGNABLE, 'Nothing to sign off');
      await tx
        .update(shifts)
        .set({ signedOffBy: actor.id, signedOffAt: new Date(), signOffNote: note })
        .where(eq(shifts.id, id));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'SHIFT_SIGN_OFF',
        entity: 'shift',
        entityId: id,
        reason: note,
      });
    });
    return this.get(actor, id);
  }

  // ------------------------------------------------------------ reading

  async list(filter: { registerId?: string; needsAttention?: boolean; page: number }) {
    const where = and(
      filter.registerId ? eq(shifts.registerId, filter.registerId) : undefined,
      filter.needsAttention
        ? sql`(${shifts.status} = 'LEFT_OPEN' or (${shifts.hasDifference} and ${shifts.signedOffAt} is null))`
        : undefined,
    );
    const rows = await this.db
      .select({ shift: shifts, register: registers.name, openedBy: users.name })
      .from(shifts)
      .innerJoin(registers, eq(registers.id, shifts.registerId))
      .innerJoin(users, eq(users.id, shifts.openedBy))
      .where(where)
      .orderBy(desc(shifts.openedAt))
      .limit(50)
      .offset((filter.page - 1) * 50);
    return rows.map((r) => ({
      id: r.shift.id,
      number: r.shift.number,
      register: r.register,
      status: r.shift.status,
      businessDate: r.shift.businessDate,
      openedBy: r.openedBy,
      openedAt: r.shift.openedAt.toISOString(),
      closedAt: r.shift.closedAt?.toISOString() ?? null,
      hasDifference: r.shift.hasDifference,
      signedOff: r.shift.signedOffAt !== null,
    }));
  }

  async get(actor: Actor, id: string): Promise<ShiftView> {
    const [row] = await this.db
      .select({ shift: shifts, register: registers, openedBy: users.name })
      .from(shifts)
      .innerJoin(registers, eq(registers.id, shifts.registerId))
      .innerJoin(users, eq(users.id, shifts.openedBy))
      .where(eq(shifts.id, id));
    if (!row) throw notFound('Shift');
    const s = row.shift;
    if (s.openedBy !== actor.id && !roleCan(actor.role, 'shifts.viewAll')) {
      // Anyone may sell on an open till; only its opener and managers see the shift detail.
      if (s.status !== 'OPEN') throw forbidden(SALES_ERRORS.SHIFT_NOT_YOURS, 'Not your shift');
    }
    const counted = s.status === 'COUNTED' || s.status === 'CLOSED';
    const closedBy = s.closedBy
      ? ((
          await this.db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.id, s.closedBy))
        )[0] ?? null)
      : null;
    const float = await this.db
      .select({ currency: shiftCounts.currency, amount: shiftCounts.amount })
      .from(shiftCounts)
      .where(and(eq(shiftCounts.shiftId, id), eq(shiftCounts.kind, 'OPENING')));
    const [saleTotals] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${sales.total}),0)::text`,
      })
      .from(sales)
      .where(and(eq(sales.shiftId, id), eq(sales.status, 'COMPLETED')));
    const byMethod = await this.db
      .select({
        method: payments.method,
        amount: sql<string>`coalesce(sum(case when ${payments.direction} = 'IN' then ${payments.amountDefault} else -${payments.amountDefault} end),0)::text`,
      })
      .from(payments)
      .where(and(eq(payments.shiftId, id), isNull(payments.reversedAt)))
      .groupBy(payments.method);
    const movements = await this.db
      .select({ m: cashMovements, by: users.name })
      .from(cashMovements)
      .innerJoin(users, eq(users.id, cashMovements.createdBy))
      .where(eq(cashMovements.shiftId, id))
      .orderBy(asc(cashMovements.createdAt));
    return {
      id: s.id,
      number: s.number,
      register: { id: row.register.id, name: row.register.name },
      status: s.status,
      businessDate: s.businessDate,
      openedBy: { id: s.openedBy, name: row.openedBy },
      openedAt: s.openedAt.toISOString(),
      countedAt: s.countedAt?.toISOString() ?? null,
      closedAt: s.closedAt?.toISOString() ?? null,
      closedBy,
      closeNote: s.closeNote,
      hasDifference: s.hasDifference,
      signedOffAt: s.signedOffAt?.toISOString() ?? null,
      signOffNote: s.signOffNote,
      float,
      reconciliation: counted ? await this.reconcile(this.db, id) : null,
      totals: {
        sales: saleTotals?.count ?? 0,
        salesTotal: counted ? addMoney(saleTotals?.total ?? '0') : null,
        byMethod: byMethod
          .filter((m) => counted || m.method !== 'CASH')
          .map((m) => ({ method: m.method as PaymentMethod, amount: addMoney(m.amount) })),
      },
      // Drawer movements reveal cash flow but not the expected total; the opener sees them.
      movements: movements.map(({ m, by }): CashMovementView => ({
        id: m.id,
        number: m.number,
        type: m.type,
        currency: m.currency,
        amount: m.amount,
        amountDefault: m.amountDefault,
        counterpart: m.counterpart,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        createdBy: by,
        reversed: m.reversedAt !== null,
      })),
    };
  }

  /** Expected cash per currency, line by line (proposal C10). */
  async expected(executor: Executor, shiftId: string) {
    const result = new Map<string, { expected: string; lines: ExpectedLine[] }>();
    const add = (
      currency: string,
      kind: ExpectedLine['kind'],
      amount: string,
      count: number,
      sign: 1 | -1,
    ) => {
      const entry = result.get(currency) ?? { expected: '0.00', lines: [] };
      entry.lines.push({ kind, amount: addMoney(amount), count });
      entry.expected = addMoney(entry.expected, sign === 1 ? amount : fromMinor(-toMinor(amount)));
      result.set(currency, entry);
    };
    for (const f of await executor
      .select({ currency: shiftCounts.currency, amount: shiftCounts.amount })
      .from(shiftCounts)
      .where(and(eq(shiftCounts.shiftId, shiftId), eq(shiftCounts.kind, 'OPENING'))))
      add(f.currency, 'OPENING_FLOAT', f.amount, 1, 1);
    const cash = await executor
      .select({
        currency: payments.currency,
        direction: payments.direction,
        purpose: payments.purpose,
        total: sql<string>`sum(${payments.amount})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(eq(payments.shiftId, shiftId), eq(payments.method, 'CASH')))
      .groupBy(payments.currency, payments.direction, payments.purpose);
    for (const c of cash) {
      const kind: ExpectedLine['kind'] =
        c.direction === 'IN'
          ? c.purpose === 'REPAYMENT'
            ? 'CASH_REPAYMENTS'
            : 'CASH_SALES'
          : c.purpose === 'CHANGE'
            ? 'CHANGE_GIVEN'
            : 'CASH_REFUNDS';
      add(c.currency, kind, c.total, c.count, c.direction === 'IN' ? 1 : -1);
    }
    const moves = await executor
      .select({
        currency: cashMovements.currency,
        type: cashMovements.type,
        total: sql<string>`sum(${cashMovements.amount})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(cashMovements)
      .where(and(eq(cashMovements.shiftId, shiftId), isNull(cashMovements.reversedAt)))
      .groupBy(cashMovements.currency, cashMovements.type);
    const [shift] = await executor.select().from(shifts).where(eq(shifts.id, shiftId));
    for (const m of moves) {
      // Drops made at close come after the count and are not part of what was expected then.
      if (m.type === 'DROP' && shift?.countedAt) {
        const [before] = await executor
          .select({
            total: sql<string>`coalesce(sum(${cashMovements.amount}),0)::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(cashMovements)
          .where(
            and(
              eq(cashMovements.shiftId, shiftId),
              eq(cashMovements.type, 'DROP'),
              eq(cashMovements.currency, m.currency),
              lt(cashMovements.createdAt, shift.countedAt),
            ),
          );
        if (before && before.count > 0) add(m.currency, 'DROPS', before.total, before.count, -1);
        continue;
      }
      add(
        m.currency,
        m.type === 'PAID_IN' ? 'PAID_IN' : m.type === 'DROP' ? 'DROPS' : 'EXPENSES',
        m.total,
        m.count,
        m.type === 'PAID_IN' ? 1 : -1,
      );
    }
    return result;
  }

  private async reconcile(executor: Executor, shiftId: string): Promise<CurrencyReconciliation[]> {
    const expected = await this.expected(executor, shiftId);
    const counts = await this.finalCounts(executor, shiftId);
    const all = [...new Set([...expected.keys(), ...counts.keys()])].sort();
    return all.map((currency) => {
      const e = expected.get(currency)?.expected ?? '0.00';
      const c = counts.get(currency) ?? null;
      return {
        currency,
        expected: e,
        counted: c,
        difference: c === null ? null : addMoney(c, fromMinor(-toMinor(e))),
        lines: expected.get(currency)?.lines ?? [],
      };
    });
  }

  /** The latest count per currency (a recount wins over the closing count). */
  private async finalCounts(executor: Executor, shiftId: string): Promise<Map<string, string>> {
    const rows = await executor
      .select()
      .from(shiftCounts)
      .where(
        and(eq(shiftCounts.shiftId, shiftId), inArray(shiftCounts.kind, ['CLOSING', 'RECOUNT'])),
      )
      .orderBy(asc(shiftCounts.countedAt), asc(shiftCounts.id));
    const map = new Map<string, string>();
    const latest = rows.some((r) => r.kind === 'RECOUNT')
      ? rows.filter(
          (r) =>
            r.kind === 'RECOUNT' &&
            r.countedAt.getTime() ===
              rows
                .filter((x) => x.kind === 'RECOUNT')
                .at(-1)!
                .countedAt.getTime(),
        )
      : rows.filter((r) => r.kind === 'CLOSING');
    for (const r of latest) map.set(r.currency, r.amount);
    return map;
  }

  private async lockShift(tx: Transaction, id: string): Promise<Shift> {
    const [shift] = await tx.select().from(shifts).where(eq(shifts.id, id)).for('update');
    if (!shift) throw notFound('Shift');
    return shift;
  }

  private assertOwnerOrManager(actor: Actor, shift: Shift, capability: 'shifts.closeOthers') {
    if (shift.openedBy !== actor.id && !roleCan(actor.role, capability))
      throw forbidden(SALES_ERRORS.SHIFT_NOT_YOURS, 'Only the person who opened it or a manager');
  }
}
