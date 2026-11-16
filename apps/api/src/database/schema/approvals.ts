import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './core.js';

export const approvalKind = pgEnum('approval_kind', [
  'PRICE_CHANGE',
  'STOCK_ADJUSTMENT',
  'PRODUCT_HIDE',
  'IMAGE_DELETE',
  'REFUND',
  'VOID',
]);
export const approvalStatus = pgEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

/**
 * One inbox for the employee actions that wait for a manager (proposal C12). The request keeps
 * the whole action as asked; approving runs it, in the same transaction as the decision.
 * Decided requests never change again.
 */
export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: approvalKind('kind').notNull(),
    status: approvalStatus('status').notNull().default('PENDING'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    payload: jsonb('payload').notNull(),
    summary: jsonb('summary').notNull(),
    reason: text('reason').notNull(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    resultId: text('result_id'),
  },
  (t) => [
    index('approval_requests_status_idx').on(t.status, t.requestedAt),
    index('approval_requests_requester_idx').on(t.requestedBy, t.requestedAt),
    // One open request per thing: a second price change for the same product waits its turn.
    uniqueIndex('approval_requests_one_pending')
      .on(t.kind, t.entityType, t.entityId)
      .where(sql`${t.status} = 'PENDING' and ${t.entityId} is not null`),
  ],
);
