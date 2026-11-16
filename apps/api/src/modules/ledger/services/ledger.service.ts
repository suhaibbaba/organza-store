import { Injectable } from '@nestjs/common';
import { type AccountCode, addMoney, fromMinor, toMinor } from '@organza/shared';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { AppError, conflict, notFound } from '../../../common/lib/app-error.js';
import { businessDate } from '../../../common/lib/dates.js';
import { InjectDb } from '../../../database/database.module.js';
import { journalEntries, journalLines } from '../../../database/schema/index.js';
import type { Database, Executor, Transaction } from '../../../database/unit-of-work.js';
import { SettingsService } from '../../settings/services/settings.service.js';

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'COURIER';

export interface PostingLine {
  account: AccountCode;
  /** Signed decimal string in the default currency: debit positive, credit negative. */
  amount: string;
  partyType?: PartyType;
  partyId?: string;
  dimension?: string;
}

export interface PostingInput {
  sourceType: string;
  sourceId: string;
  event: string;
  memo?: string;
  createdBy: string | null;
  /** Defaults to today in the shop's time zone. */
  entryDate?: string;
  lines: PostingLine[];
}

export const LEDGER_ERRORS = {
  UNBALANCED: 'LEDGER_UNBALANCED',
  ALREADY_REVERSED: 'LEDGER_ALREADY_REVERSED',
} as const;

/** Debit / credit helpers so posting rules read like the table in proposal E. */
export const debit = (
  account: AccountCode,
  amount: string,
  extra: Omit<PostingLine, 'account' | 'amount'> = {},
): PostingLine => ({
  account,
  amount: fromMinor(toMinor(amount)),
  ...extra,
});
export const credit = (
  account: AccountCode,
  amount: string,
  extra: Omit<PostingLine, 'account' | 'amount'> = {},
): PostingLine => ({
  account,
  amount: fromMinor(-toMinor(amount)),
  ...extra,
});

/**
 * The automatic double-entry ledger. Documents call `post` inside their own transaction;
 * zero lines are dropped and lines on the same account and party are merged. The database
 * checks again at commit that each entry balances.
 */
@Injectable()
export class LedgerService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  async today(executor: Executor = this.db): Promise<string> {
    return businessDate((await this.settings.get(executor)).timezone);
  }

  async post(tx: Transaction, input: PostingInput): Promise<string | null> {
    const merged = new Map<string, PostingLine & { minor: number }>();
    for (const line of input.lines) {
      const minor = toMinor(line.amount);
      if (minor === 0) continue;
      const key = [
        line.account,
        line.partyType ?? '',
        line.partyId ?? '',
        line.dimension ?? '',
      ].join('|');
      const existing = merged.get(key);
      if (existing) existing.minor += minor;
      else merged.set(key, { ...line, minor });
    }
    const lines = [...merged.values()].filter((l) => l.minor !== 0);
    if (lines.length === 0) return null;
    const total = lines.reduce((sum, l) => sum + l.minor, 0);
    if (total !== 0 || lines.length < 2) {
      throw new AppError(
        500,
        LEDGER_ERRORS.UNBALANCED,
        `Posting ${input.event} does not balance (${fromMinor(total)})`,
        {
          lines: input.lines,
        },
      );
    }
    const entryDate = input.entryDate ?? (await this.today(tx));
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        entryDate,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        event: input.event,
        memo: input.memo ?? null,
        createdBy: input.createdBy,
      })
      .returning({ id: journalEntries.id });
    if (!entry) throw new Error('journal entry not inserted');
    await tx.insert(journalLines).values(
      lines.map((l) => ({
        entryId: entry.id,
        account: l.account,
        amount: fromMinor(l.minor),
        partyType: l.partyType ?? null,
        partyId: l.partyId ?? null,
        dimension: l.dimension ?? null,
      })),
    );
    return entry.id;
  }

  /** Rule 2: stamps the original and posts its mirror image dated today. */
  async reverse(
    tx: Transaction,
    entryId: string,
    createdBy: string | null,
    memo: string,
  ): Promise<string> {
    const [original] = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, entryId))
      .for('update');
    if (!original) throw notFound('Journal entry');
    if (original.reversedAt || original.reversesId) {
      throw conflict(
        LEDGER_ERRORS.ALREADY_REVERSED,
        'Entry already reversed or is itself a reversal',
      );
    }
    const lines = await tx.select().from(journalLines).where(eq(journalLines.entryId, entryId));
    await tx
      .update(journalEntries)
      .set({ reversedAt: new Date() })
      .where(eq(journalEntries.id, entryId));
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        entryDate: await this.today(tx),
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        event: `${original.event}_REVERSED`,
        memo,
        createdBy,
        reversesId: original.id,
      })
      .returning({ id: journalEntries.id });
    if (!entry) throw new Error('reversal not inserted');
    await tx.insert(journalLines).values(
      lines.map((l) => ({
        entryId: entry.id,
        account: l.account,
        amount: fromMinor(-toMinor(l.amount)),
        partyType: l.partyType,
        partyId: l.partyId,
        dimension: l.dimension,
      })),
    );
    return entry.id;
  }

  /** Signed balance (debit positive) of an account, optionally for one party and up to a date. */
  async balance(
    executor: Executor,
    account: AccountCode,
    filter: { partyType?: PartyType; partyId?: string; upTo?: string } = {},
  ): Promise<string> {
    const [row] = await executor
      .select({ total: sql<string>`coalesce(sum(${journalLines.amount}), 0)::text` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(
        and(
          eq(journalLines.account, account),
          filter.partyType ? eq(journalLines.partyType, filter.partyType) : undefined,
          filter.partyId ? eq(journalLines.partyId, filter.partyId) : undefined,
          filter.upTo ? lte(journalEntries.entryDate, filter.upTo) : undefined,
        ),
      );
    return addMoney(row?.total ?? '0');
  }

  /** Trial balance: every account's signed balance; the total is always zero. */
  async trialBalance(
    executor: Executor = this.db,
    upTo?: string,
  ): Promise<{ account: string; balance: string }[]> {
    const rows = await executor
      .select({
        account: journalLines.account,
        total: sql<string>`sum(${journalLines.amount})::text`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(upTo ? lte(journalEntries.entryDate, upTo) : undefined)
      .groupBy(journalLines.account)
      .orderBy(journalLines.account);
    return rows.map((r) => ({ account: r.account, balance: addMoney(r.total) }));
  }

  async entriesFor(executor: Executor, sourceType: string, sourceId: string) {
    return executor
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)));
  }

  async activeEntriesFor(executor: Executor, sourceType: string, sourceId: string) {
    return executor
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceType, sourceType),
          eq(journalEntries.sourceId, sourceId),
          isNull(journalEntries.reversedAt),
          isNull(journalEntries.reversesId),
        ),
      );
  }
}
