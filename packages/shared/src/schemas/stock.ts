import { z } from 'zod';
import { idempotencyKeySchema } from './common.js';

/** Reasons a person can pick for a manual adjustment. Sales, returns and purchases have their own screens. */
export const ADJUSTMENT_REASONS = [
  'DAMAGE',
  'LOSS',
  'FOUND',
  'WRITE_OFF_DAMAGED',
  'COUNT_ADJUSTMENT',
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const adjustmentLineSchema = z
  .object({
    itemId: z.uuid(),
    /** Signed change. DAMAGE moves pieces from on hand to damaged; WRITE_OFF_DAMAGED removes damaged ones. */
    delta: z.number().int().min(-10_000).max(10_000).optional(),
    /** Or the counted on-hand quantity (COUNT_ADJUSTMENT only); the delta is derived from it. */
    counted: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((l) => (l.delta === undefined) !== (l.counted === undefined), 'GIVE_DELTA_OR_COUNTED');

export const createAdjustmentSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.enum(ADJUSTMENT_REASONS),
  note: z.string().trim().max(500).optional(),
  lines: z.array(adjustmentLineSchema).min(1).max(200),
});
export type CreateAdjustmentInput = z.input<typeof createAdjustmentSchema>;

export const reverseDocumentSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export const createCountSchema = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
});

export const countLineSchema = z.object({
  itemId: z.uuid(),
  counted: z.number().int().min(0).max(100_000),
});

export const countLinesSchema = z.object({ lines: z.array(countLineSchema).min(1).max(500) });

export const stockListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  lowStock: z.coerce.boolean().optional(),
  damaged: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export interface StockRow {
  itemId: string;
  productId: string;
  productNumber: number;
  sku: string;
  name: { ar?: string; en?: string; he?: string };
  options: string[];
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
  lowStock: boolean;
  location: string | null;
}

export interface MovementRow {
  id: string;
  occurredAt: string;
  bucket: 'ON_HAND' | 'DAMAGED';
  quantity: number;
  reason: string;
  sourceType: string;
  sourceId: string;
  note: string | null;
  createdBy: string | null;
  reversed: boolean;
  isReversal: boolean;
}

export interface CountLineView {
  itemId: string;
  sku: string;
  name: { ar?: string; en?: string; he?: string };
  counted: number;
  /** Live on-hand while open, frozen at posting. */
  system: number;
  difference: number;
  countedAt: string;
}

export interface CountView {
  id: string;
  number: string;
  title: string;
  status: 'OPEN' | 'POSTED' | 'CANCELLED';
  note: string | null;
  createdAt: string;
  postedAt: string | null;
  lines: CountLineView[];
}
