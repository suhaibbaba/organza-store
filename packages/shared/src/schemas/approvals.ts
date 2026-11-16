import { z } from 'zod';
import { nonNegativeMoneySchema, paginationSchema, uuidSchema } from './common.js';
import { createAdjustmentSchema } from './stock.js';
import { createReturnSchema, voidSaleSchema } from './sales.js';

/**
 * The short list of employee actions that wait for a manager (proposal C12). Each request
 * carries a delta or a whole document, never an old absolute value: a price change states the
 * price it replaces and is refused as stale if that has changed meanwhile.
 */
export const APPROVAL_KINDS = [
  'PRICE_CHANGE',
  'STOCK_ADJUSTMENT',
  'PRODUCT_HIDE',
  'IMAGE_DELETE',
  'REFUND',
  'VOID',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];
export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const reason = z.string().trim().min(3).max(500);

export const approvalRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('PRICE_CHANGE'),
    reason,
    /** A product's price, or one item's own price (null: back to the product's price). */
    target: z.enum(['product', 'item']),
    id: uuidSchema,
    price: nonNegativeMoneySchema.nullable(),
  }),
  z.object({ kind: z.literal('STOCK_ADJUSTMENT'), reason, adjustment: createAdjustmentSchema }),
  z.object({
    kind: z.literal('PRODUCT_HIDE'),
    reason,
    productId: uuidSchema,
    status: z.enum(['ACTIVE', 'HIDDEN']),
  }),
  z.object({ kind: z.literal('IMAGE_DELETE'), reason, imageId: uuidSchema }),
  /** A return or exchange whose refund is above the employee limit, exactly as entered. */
  z.object({ kind: z.literal('REFUND'), reason, request: createReturnSchema }),
  z.object({ kind: z.literal('VOID'), reason, saleId: uuidSchema, request: voidSaleSchema }),
]);
export type ApprovalRequestInput = z.input<typeof approvalRequestSchema>;

export const approvalDecisionSchema = z.object({ note: z.string().trim().max(500).optional() });
export const approvalRejectSchema = z.object({ note: z.string().trim().min(3).max(500) });

export const approvalListQuerySchema = paginationSchema.extend({
  status: z.enum(APPROVAL_STATUSES).optional(),
  /** Only the signed-in person's own requests. */
  mine: z.stringbool().optional(),
});

export interface ApprovalView {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  reason: string;
  /** What the screen shows: names, from and to, amounts; already resolved by the server. */
  summary: Record<string, unknown>;
  entityType: string | null;
  entityId: string | null;
  requestedBy: { id: string; name: string };
  requestedAt: string;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** The document the approval produced (return, adjustment), when there is one. */
  resultId: string | null;
}
