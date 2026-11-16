import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { items } from './catalogue.js';
import { users } from './core.js';
import { stockBucket } from './ledger.js';

/** Human document numbers: `<KIND>-<YEAR>-<0001>`. */
export const documentCounters = pgTable(
  'document_counters',
  {
    kind: text('kind').notNull(),
    year: integer('year').notNull(),
    last: integer('last').notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })],
);

/** A manual stock adjustment: the reason and who, with one line per item. */
export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull().unique(),
  reason: text('reason').notNull(),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockAdjustmentLines = pgTable(
  'stock_adjustment_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adjustmentId: uuid('adjustment_id')
      .notNull()
      .references(() => stockAdjustments.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    bucket: stockBucket('bucket').notNull().default('ON_HAND'),
    /** What the person entered: a delta, or the counted quantity it was derived from. */
    delta: integer('delta').notNull(),
    countedQuantity: integer('counted_quantity'),
    previousQuantity: integer('previous_quantity').notNull(),
  },
  (t) => [index('stock_adjustment_lines_adj_idx').on(t.adjustmentId)],
);

export const stockCountStatus = pgEnum('stock_count_status', ['OPEN', 'POSTED', 'CANCELLED']);

/** A physical count: lines are counted over time, reviewed, then posted as movements. */
export const stockCounts = pgTable('stock_counts', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull().unique(),
  title: text('title').notNull(),
  status: stockCountStatus('status').notNull().default('OPEN'),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  postedBy: uuid('posted_by').references(() => users.id),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
});

export const stockCountLines = pgTable(
  'stock_count_lines',
  {
    countId: uuid('count_id')
      .notNull()
      .references(() => stockCounts.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    counted: integer('counted').notNull(),
    /** Filled when the count is posted: what the system held at that moment. */
    systemQuantity: integer('system_quantity'),
    countedBy: uuid('counted_by').references(() => users.id),
    countedAt: timestamp('counted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.countId, t.itemId] })],
);
