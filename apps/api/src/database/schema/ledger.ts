import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { items } from './catalogue.js';
import { users } from './core.js';

export const accountType = pgEnum('account_type', [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
]);

/** The fixed chart of accounts, seeded by migration. */
export const accounts = pgTable('accounts', {
  code: text('code').primaryKey(),
  type: accountType('type').notNull(),
});

/**
 * One entry per document event. Append-only; a correction is a new entry with `reverses_id`.
 * Lines are in the default currency and always sum to zero (deferred trigger).
 */
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The business date the entry belongs to (the shop's day). */
    entryDate: date('entry_date').notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    event: text('event').notNull(),
    memo: text('memo'),
    createdBy: uuid('created_by').references(() => users.id),
    reversesId: uuid('reverses_id').references((): AnyPgColumn => journalEntries.id),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
  },
  (t) => [
    index('journal_entries_source_idx').on(t.sourceType, t.sourceId),
    index('journal_entries_date_idx').on(t.entryDate),
    uniqueIndex('journal_entries_one_reversal')
      .on(t.reversesId)
      .where(sql`${t.reversesId} is not null`),
  ],
);

export const partyType = pgEnum('party_type', ['CUSTOMER', 'SUPPLIER', 'COURIER']);

export const journalLines = pgTable(
  'journal_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => journalEntries.id),
    account: text('account')
      .notNull()
      .references(() => accounts.code),
    /** Signed: debit positive, credit negative. */
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    partyType: partyType('party_type'),
    partyId: uuid('party_id'),
    /** Optional analysis key, e.g. the expense category. */
    dimension: text('dimension'),
  },
  (t) => [
    index('journal_lines_entry_idx').on(t.entryId),
    index('journal_lines_account_idx').on(t.account),
    index('journal_lines_party_idx').on(t.partyType, t.partyId),
  ],
);

/** A month that has been reviewed and locked: no entry may be dated inside it (H12). */
export const periodLocks = pgTable(
  'period_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    month: date('month').notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
    lockedBy: uuid('locked_by').references(() => users.id),
    reason: text('reason'),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    reopenedBy: uuid('reopened_by').references(() => users.id),
    reopenReason: text('reopen_reason'),
  },
  (t) => [
    uniqueIndex('period_locks_active_month')
      .on(t.month)
      .where(sql`${t.reopenedAt} is null`),
  ],
);

export const stockBucket = pgEnum('stock_bucket', ['ON_HAND', 'DAMAGED']);

/**
 * Cached balance per item, updated in the same transaction as its movements and locked while
 * it changes. Available = on_hand - reserved. A nightly job compares it to the movement sum.
 */
export const itemBalances = pgTable('item_balances', {
  itemId: uuid('item_id')
    .primaryKey()
    .references(() => items.id),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  damaged: integer('damaged').notNull().default(0),
  /** Weighted average unit cost of on-hand stock; null until a cost is known. */
  avgCost: numeric('avg_cost', { precision: 14, scale: 4 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only stock ledger. */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    bucket: stockBucket('bucket').notNull().default('ON_HAND'),
    quantity: integer('quantity').notNull(),
    reason: text('reason').notNull(),
    /** Cost per unit this movement carried (average cost out, purchase cost in). */
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }).notNull().default('0'),
    costUnknown: boolean('cost_unknown').notNull().default(false),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
    reversesId: uuid('reverses_id').references((): AnyPgColumn => stockMovements.id),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
  },
  (t) => [
    index('stock_movements_item_idx').on(t.itemId, t.occurredAt),
    index('stock_movements_source_idx').on(t.sourceType, t.sourceId),
  ],
);
