import { Injectable } from '@nestjs/common';
import {
  addMoney,
  buildSearchText,
  type customerInputSchema,
  type customerListQuerySchema,
  type CustomerView,
  fromMinor,
  nationalPhoneDigits,
  normalizeSearch,
  type Page,
  phoneIdentityKey,
  type StatementRow,
  toE164,
  toMinor,
} from '@organza/shared';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { badRequest, conflict, notFound } from '../../../common/lib/app-error.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import {
  customers,
  journalEntries,
  journalLines,
  payments,
  sales,
} from '../../../database/schema/index.js';
import {
  type Database,
  type Executor,
  inTransaction,
  type Transaction,
} from '../../../database/unit-of-work.js';
import { debit, LedgerService, type PostingLine } from '../../ledger/services/ledger.service.js';
import { SettingsService } from '../../settings/services/settings.service.js';
import { SALES_ERRORS } from '../constants.js';

type Input = z.output<typeof customerInputSchema>;

export interface PartyBalances {
  /** Receivables, positive = the customer owes. */
  debt: string;
  /** General store credit, positive = the shop owes. */
  credit: string;
  /** Deposits on held sales, positive = the shop owes. */
  deposits: string;
}

/**
 * Customers and their balances. Balances are read from the ledger (receivables and customer
 * credit for the customer as party); nothing here stores an amount.
 */
@Injectable()
export class CustomersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly ledger: LedgerService,
  ) {}

  async create(actor: Actor, input: Input): Promise<CustomerView> {
    const id = await inTransaction(this.db, async (tx) => {
      const phones = await this.phones(tx, input);
      await this.assertPhoneFree(tx, phones.phoneKey);
      const [row] = await tx
        .insert(customers)
        .values({
          name: input.name,
          ...phones,
          address: input.address,
          city: input.city,
          notes: input.notes,
          searchText: this.searchText(input.name, phones.phone, phones.whatsapp, input.city),
          createdBy: actor.id,
        })
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CUSTOMER_CREATE',
        entity: 'customer',
        entityId: row!.id,
        newValue: row,
      });
      return row!.id;
    });
    return this.get(id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<CustomerView> {
    await inTransaction(this.db, async (tx) => {
      const [before] = await tx.select().from(customers).where(eq(customers.id, id)).for('update');
      if (!before) throw notFound('Customer');
      if (before.mergedIntoId) throw conflict(SALES_ERRORS.CUSTOMER_MERGED, 'Customer was merged');
      const phones = await this.phones(tx, input);
      await this.assertPhoneFree(tx, phones.phoneKey, id);
      const [after] = await tx
        .update(customers)
        .set({
          name: input.name,
          ...phones,
          address: input.address,
          city: input.city,
          notes: input.notes,
          searchText: this.searchText(input.name, phones.phone, phones.whatsapp, input.city),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CUSTOMER_UPDATE',
        entity: 'customer',
        entityId: id,
        oldValue: before,
        newValue: after,
      });
    });
    return this.get(id);
  }

  async get(id: string, executor: Executor = this.db): Promise<CustomerView> {
    const [row] = await executor.select().from(customers).where(eq(customers.id, id));
    if (!row) throw notFound('Customer');
    const balances = await this.balances(executor, [id]);
    return this.view(row, balances.get(id));
  }

  async list(query: z.output<typeof customerListQuerySchema>): Promise<Page<CustomerView>> {
    const where: SQL[] = [isNull(customers.mergedIntoId)];
    let order: SQL[] = [asc(customers.name)];
    if (query.q) {
      const q = normalizeSearch(query.q);
      const digits = query.q.replace(/\D/g, '');
      const matches = [
        ilike(customers.searchText, `%${q}%`),
        sql`word_similarity(${q}, ${customers.searchText}) > 0.4`,
      ];
      if (digits.length >= 3)
        matches.push(ilike(customers.searchText, `%${digits.replace(/^0/, '')}%`));
      where.push(or(...matches)!);
      order = [desc(sql`word_similarity(${q}, ${customers.searchText})`), asc(customers.name)];
    }
    if (query.withDebt) {
      where.push(
        sql`(select coalesce(sum(l.amount),0) from journal_lines l where l.account = 'CUSTOMER_RECEIVABLES' and l.party_type = 'CUSTOMER' and l.party_id = ${sql.raw('customers.id')}) > 0`,
      );
    }
    const [{ total } = { total: 0 }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(...where));
    const rows = await this.db
      .select()
      .from(customers)
      .where(and(...where))
      .orderBy(...order)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const balances = await this.balances(
      this.db,
      rows.map((r) => r.id),
    );
    return {
      items: rows.map((r) => this.view(r, balances.get(r.id))),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Locks the customer row: every change to a customer's balance takes this lock first. */
  async lock(tx: Transaction, id: string) {
    const [row] = await tx.select().from(customers).where(eq(customers.id, id)).for('update');
    if (!row) throw notFound('Customer');
    if (row.mergedIntoId) throw conflict(SALES_ERRORS.CUSTOMER_MERGED, 'Customer was merged');
    return row;
  }

  async balances(executor: Executor, ids: string[]): Promise<Map<string, PartyBalances>> {
    const map = new Map<string, PartyBalances>();
    if (ids.length === 0) return map;
    const rows = await executor
      .select({
        partyId: journalLines.partyId,
        account: journalLines.account,
        held: sql<boolean>`${journalLines.dimension} is not null`,
        total: sql<string>`sum(${journalLines.amount})::text`,
      })
      .from(journalLines)
      .where(
        and(
          eq(journalLines.partyType, 'CUSTOMER'),
          inArray(journalLines.partyId, ids),
          inArray(journalLines.account, ['CUSTOMER_RECEIVABLES', 'CUSTOMER_CREDIT']),
        ),
      )
      .groupBy(
        journalLines.partyId,
        journalLines.account,
        sql`${journalLines.dimension} is not null`,
      );
    for (const id of ids) map.set(id, { debt: '0.00', credit: '0.00', deposits: '0.00' });
    for (const r of rows) {
      const b = map.get(r.partyId!)!;
      if (r.account === 'CUSTOMER_RECEIVABLES') b.debt = addMoney(b.debt, r.total);
      else if (r.held) b.deposits = addMoney(b.deposits, fromMinor(-toMinor(r.total)));
      else b.credit = addMoney(b.credit, fromMinor(-toMinor(r.total)));
    }
    return map;
  }

  /**
   * The customer's statement: every journal entry that moved their receivable or credit, with
   * a running balance (positive = owes the shop). Built from the ledger, so it always agrees.
   */
  async statement(id: string): Promise<StatementRow[]> {
    await this.get(id);
    const rows = await this.db
      .select({
        entryId: journalEntries.id,
        date: journalEntries.entryDate,
        at: journalEntries.postedAt,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        event: journalEntries.event,
        reversal: sql<boolean>`${journalEntries.reversesId} is not null`,
        amount: sql<string>`sum(${journalLines.amount})::text`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(
        and(
          eq(journalLines.partyType, 'CUSTOMER'),
          eq(journalLines.partyId, id),
          inArray(journalLines.account, ['CUSTOMER_RECEIVABLES', 'CUSTOMER_CREDIT']),
        ),
      )
      .groupBy(journalEntries.id)
      .orderBy(asc(journalEntries.seq));
    const saleIds = rows.filter((r) => r.sourceType === 'sale').map((r) => r.sourceId);
    const paymentIds = rows.filter((r) => r.sourceType === 'payment').map((r) => r.sourceId);
    const numbers = new Map<string, string>();
    if (saleIds.length)
      for (const s of await this.db
        .select({ id: sales.id, number: sales.number })
        .from(sales)
        .where(inArray(sales.id, saleIds)))
        numbers.set(s.id, s.number);
    if (paymentIds.length)
      for (const p of await this.db
        .select({ id: payments.id, number: payments.number })
        .from(payments)
        .where(inArray(payments.id, paymentIds)))
        numbers.set(p.id, p.number);
    let running = 0;
    const result: StatementRow[] = [];
    for (const r of rows) {
      const minor = toMinor(r.amount);
      if (minor === 0) continue;
      running += minor;
      result.push({
        date: r.date,
        at: r.at.toISOString(),
        kind: statementKind(r.sourceType, r.event, r.reversal),
        number: numbers.get(r.sourceId) ?? null,
        sourceId: r.sourceId,
        amount: fromMinor(minor),
        balance: fromMinor(running),
        event: r.event,
      });
    }
    return result;
  }

  /**
   * Admin: moves the duplicate's history into `targetId`. Documents are re-pointed; ledger lines
   * cannot change, so the duplicate's balances are transferred with one journal entry.
   */
  async merge(actor: Actor, targetId: string, fromId: string, reason: string) {
    if (targetId === fromId) throw badRequest(SALES_ERRORS.MERGE_SELF, 'Cannot merge into itself');
    await inTransaction(this.db, async (tx) => {
      const [a, b] = [targetId, fromId].sort();
      await this.lock(tx, a!);
      await this.lock(tx, b!);
      const rows = await tx
        .select({
          account: journalLines.account,
          dimension: journalLines.dimension,
          total: sql<string>`sum(${journalLines.amount})::text`,
        })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.partyType, 'CUSTOMER'),
            eq(journalLines.partyId, fromId),
            inArray(journalLines.account, ['CUSTOMER_RECEIVABLES', 'CUSTOMER_CREDIT']),
          ),
        )
        .groupBy(journalLines.account, journalLines.dimension);
      const lines: PostingLine[] = [];
      for (const r of rows) {
        if (toMinor(r.total) === 0) continue;
        const account = r.account as 'CUSTOMER_RECEIVABLES' | 'CUSTOMER_CREDIT';
        const dim = r.dimension ? { dimension: r.dimension } : {};
        const negate = fromMinor(-toMinor(r.total));
        lines.push(
          { ...debit(account, negate), partyType: 'CUSTOMER', partyId: fromId, ...dim },
          { ...debit(account, r.total), partyType: 'CUSTOMER', partyId: targetId, ...dim },
        );
      }
      await this.ledger.post(tx, {
        sourceType: 'customer',
        sourceId: targetId,
        event: 'CUSTOMER_MERGED',
        memo: reason,
        createdBy: actor.id,
        lines,
      });
      await tx.update(sales).set({ customerId: targetId }).where(eq(sales.customerId, fromId));
      await tx
        .update(payments)
        .set({ customerId: targetId })
        .where(eq(payments.customerId, fromId));
      await tx
        .update(customers)
        .set({ mergedIntoId: targetId, phoneKey: null, updatedAt: new Date() })
        .where(eq(customers.id, fromId));
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'CUSTOMER_MERGE',
        entity: 'customer',
        entityId: targetId,
        newValue: { mergedFrom: fromId },
        reason,
      });
    });
    return this.get(targetId);
  }

  view(row: typeof customers.$inferSelect, b?: PartyBalances): CustomerView {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      whatsapp: row.whatsapp,
      address: row.address,
      city: row.city,
      notes: row.notes,
      debt: b?.debt ?? '0.00',
      credit: b?.credit ?? '0.00',
      deposits: b?.deposits ?? '0.00',
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async phones(executor: Executor, input: Input) {
    const { defaultCountryCode } = await this.settings.get(executor);
    const parse = (raw: string | null, field: string) => {
      if (!raw) return null;
      const e164 = toE164(raw, defaultCountryCode);
      if (!e164) throw badRequest(SALES_ERRORS.PHONE_INVALID, 'Not a phone number', { field });
      return e164;
    };
    const phone = parse(input.phone, 'phone');
    const whatsapp = parse(input.whatsapp, 'whatsapp');
    return { phone, whatsapp, phoneKey: phone ? phoneIdentityKey(phone) : null };
  }

  private async assertPhoneFree(executor: Executor, key: string | null, exceptId?: string) {
    if (!key) return;
    const [taken] = await executor
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(eq(customers.phoneKey, key), isNull(customers.mergedIntoId)));
    if (taken && taken.id !== exceptId)
      throw conflict(SALES_ERRORS.PHONE_TAKEN, 'Phone belongs to another customer', {
        customerId: taken.id,
        name: taken.name,
      });
  }

  private searchText(
    name: string,
    phone: string | null,
    whatsapp: string | null,
    city: string | null,
  ) {
    return buildSearchText(
      name,
      phone ? nationalPhoneDigits(phone) : '',
      whatsapp ? nationalPhoneDigits(whatsapp) : '',
      city ?? '',
    );
  }
}

function statementKind(sourceType: string, event: string, reversal: boolean): StatementRow['kind'] {
  if (reversal) return 'CORRECTION';
  if (event.startsWith('HELD_CANCELLED')) return 'CANCEL';
  if (event === 'HANDOVER') return 'HANDOVER';
  if (sourceType === 'sale') return 'SALE';
  if (sourceType === 'payment') return event === 'PAYMENT_OUT' ? 'REFUND' : 'PAYMENT';
  return 'OTHER';
}
