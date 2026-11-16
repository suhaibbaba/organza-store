import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum('user_role', ['ADMIN', 'MANAGER', 'EMPLOYEE']);
export const language = pgEnum('language', ['ar', 'en', 'he']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    role: userRole('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Hash format carried over from the old system; re-hashed with argon2 at first sign-in. */
    legacyPasswordHash: text('legacy_password_hash'),
    language: language('language').notNull().default('ar'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_uniq').on(sql`lower(${t.email})`)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    client: text('client').notNull().default('web'),
    persistent: boolean('persistent').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uniq').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
  ],
);

export const loginThrottles = pgTable('login_throttles', {
  key: text('key').primaryKey(),
  failures: integer('failures').notNull().default(0),
  firstFailureAt: timestamp('first_failure_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

/** Append-only (trigger). Written in the same transaction as the change it describes. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    reason: text('reason'),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entity, t.entityId, t.occurredAt),
    index('audit_log_user_idx').on(t.userId, t.occurredAt),
  ],
);

/** Same key + scope returns the stored response instead of repeating the write (kept 7 days). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: text('scope').notNull(),
    key: uuid('key').notNull(),
    userId: uuid('user_id').references(() => users.id),
    requestHash: text('request_hash').notNull(),
    response: jsonb('response').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.key] }),
    index('idempotency_keys_created_idx').on(t.createdAt),
  ],
);

/** Notifications and other side effects, written in the transaction and sent after commit. */
export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: createdAt(),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (t) => [
    index('outbox_pending_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.sentAt} is null`),
  ],
);

/** One row per daily job per shop date: the first instance to insert it runs the job. */
export const jobRuns = pgTable(
  'job_runs',
  {
    name: text('name').notNull(),
    runDate: text('run_date').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    result: jsonb('result'),
    error: text('error'),
  },
  (t) => [primaryKey({ columns: [t.name, t.runDate] })],
);
