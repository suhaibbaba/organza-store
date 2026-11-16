import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';

/** One row (`id = 'shop'`) holding the validated settings document. */
export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

/**
 * Accepted currencies. Exactly one is the default: prices, debts and the ledger are in it.
 */
export const currencies = pgTable(
  'currencies',
  {
    code: char('code', { length: 3 }).primaryKey(),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('currencies_one_default')
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ],
);

/** Append-only history of rates; the latest row per currency is the current rate. */
export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    currency: char('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code),
    /** Default-currency units for one unit of `currency`. */
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
    setBy: uuid('set_by').references(() => users.id),
  },
  (t) => [index('exchange_rates_currency_idx').on(t.currency, t.setAt)],
);
