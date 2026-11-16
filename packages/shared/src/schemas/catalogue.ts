import { z } from 'zod';
import { isValidBarcode, normalizeBarcode } from '../barcode.js';
import {
  idempotencyKeySchema,
  moneySchema,
  nonNegativeMoneySchema,
  translatableSchema,
} from './common.js';

const optionalTranslatable = z
  .object({
    ar: z.string().trim().max(2000).optional(),
    en: z.string().trim().max(2000).optional(),
    he: z.string().trim().max(2000).optional(),
  })
  .default({});

export const barcodeInputSchema = z
  .string()
  .transform(normalizeBarcode)
  .refine(isValidBarcode, 'INVALID_BARCODE');

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const stockQuantity = z.number().int().min(0).max(100_000);
const percent = z.number().min(0).max(100);

const productBase = {
  name: translatableSchema,
  description: optionalTranslatable,
  categoryId: z.uuid(),
  price: nonNegativeMoneySchema,
  compareAtPrice: nonNegativeMoneySchema.optional(),
  /** Admin only; ignored for other roles. */
  cost: nonNegativeMoneySchema.optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  imageIds: z.array(z.uuid()).max(20).default([]),
  idempotencyKey: idempotencyKeySchema,
};

export const createRegularProductSchema = z.object({
  type: z.literal('REGULAR'),
  ...productBase,
  stock: stockQuantity.default(1),
  /** The supplier's code; when omitted an in-store EAN-13 is generated. */
  barcode: barcodeInputSchema.optional(),
});

export const variantItemInputSchema = z.object({
  valueIds: z.array(z.uuid()).min(1).max(3),
  stock: stockQuantity.default(0),
  price: nonNegativeMoneySchema.optional(),
  cost: nonNegativeMoneySchema.optional(),
  barcode: barcodeInputSchema.optional(),
});

export const createVariantProductSchema = z.object({
  type: z.literal('VARIANT'),
  ...productBase,
  optionTypeIds: z.array(z.uuid()).min(1).max(3),
  /** Only the ticked combinations. */
  items: z.array(variantItemInputSchema).min(1).max(200),
  /** One supplier code for every variant: scanning it opens the variant picker. */
  sharedBarcode: barcodeInputSchema.optional(),
  optionNotes: z
    .array(z.object({ valueId: z.uuid(), note: translatableSchema }))
    .max(50)
    .default([]),
});

export const numberedItemInputSchema = z.object({
  number: z.number().int().min(1).max(10_000),
  stock: stockQuantity.default(1),
  photoX: percent.optional(),
  photoY: percent.optional(),
  price: nonNegativeMoneySchema.optional(),
  cost: nonNegativeMoneySchema.optional(),
  barcode: barcodeInputSchema.optional(),
});

export const createNumberedProductSchema = z.object({
  type: z.literal('NUMBERED'),
  ...productBase,
  items: z.array(numberedItemInputSchema).min(1).max(500),
  pointTextColor: hexColor.optional(),
  pointBackgroundColor: hexColor.optional(),
});

export const createProductSchema = z.discriminatedUnion('type', [
  createRegularProductSchema,
  createVariantProductSchema,
  createNumberedProductSchema,
]);
export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = z.object({
  version: z.number().int().min(1),
  name: translatableSchema.optional(),
  description: optionalTranslatable.optional(),
  categoryId: z.uuid().optional(),
  price: nonNegativeMoneySchema.optional(),
  compareAtPrice: nonNegativeMoneySchema.nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).nullable().optional(),
  status: z.enum(['ACTIVE', 'HIDDEN']).optional(),
  pointTextColor: hexColor.nullable().optional(),
  pointBackgroundColor: hexColor.nullable().optional(),
  optionNotes: z
    .array(z.object({ valueId: z.uuid(), note: translatableSchema.nullable() }))
    .max(50)
    .optional(),
});
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const updateItemSchema = z.object({
  price: nonNegativeMoneySchema.nullable().optional(),
  location: z.string().trim().max(80).nullable().optional(),
  photoX: percent.nullable().optional(),
  photoY: percent.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const addItemsSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  variants: z.array(variantItemInputSchema).max(200).default([]),
  numbers: z.array(numberedItemInputSchema).max(500).default([]),
});

export const setItemCostSchema = z.object({ cost: nonNegativeMoneySchema });

export const addBarcodeSchema = z.object({
  code: barcodeInputSchema,
  /** Omitted: the code is shared by every item of the product. */
  itemId: z.uuid().optional(),
});

export const archiveProductSchema = z.object({
  /** What to do with stock still on hand: write it off as loss, or keep it counted. */
  stock: z.enum(['WRITE_OFF', 'KEEP']),
  reason: z.string().trim().max(500).optional(),
});

/** Quick sell at the till: a name and a price; the product is completed later by a manager. */
export const quickSellSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  name: translatableSchema,
  price: nonNegativeMoneySchema,
  /** Pieces in hand, all about to be sold. */
  quantity: z.number().int().min(1).max(100).default(1),
});
export type QuickSellInput = z.input<typeof quickSellSchema>;

/** Closes a quick-sold product's review: completed (has a category) or kept as a one-off. */
export const quickSellReviewSchema = z.object({
  version: z.number().int().min(1),
  outcome: z.enum(['COMPLETED', 'ONE_OFF']),
});

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(['ACTIVE', 'HIDDEN', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  type: z.enum(['REGULAR', 'VARIANT', 'NUMBERED']).optional(),
  lowStock: z.stringbool().optional(),
  needsCompletion: z.stringbool().optional(),
  labelsPending: z.stringbool().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const categoryInputSchema = z.object({
  name: translatableSchema,
  parentId: z.uuid().nullable().optional(),
  isFavorite: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const optionTypeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_-]{0,30}$/),
  name: translatableSchema,
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const optionValueInputSchema = z.object({
  value: translatableSchema,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const moneyOrNull = moneySchema.nullable();

// ---- read models ----

export type T3 = { ar?: string; en?: string; he?: string };

export interface ImageView {
  id: string;
  itemId: string | null;
  thumbnailUrl: string;
  mediumUrl: string;
  fullUrl: string;
  originalUrl: string | null;
  isPrimary: boolean;
  brightness: string | null;
}

export interface StockView {
  onHand: number;
  reserved: number;
  damaged: number;
  available: number;
}

export interface ItemView {
  id: string;
  number: number;
  sku: string;
  price: string | null;
  effectivePrice: string;
  /** Admin only. */
  avgCost?: string | null;
  photoX: string | null;
  photoY: string | null;
  location: string | null;
  isActive: boolean;
  archivedAt: string | null;
  options: { typeId: string; valueId: string; key: string; value: T3 }[];
  barcodes: { code: string; source: 'GENERATED' | 'SUPPLIER' }[];
  stock: StockView;
}

export interface ProductView {
  id: string;
  number: number;
  type: 'REGULAR' | 'VARIANT' | 'NUMBERED';
  name: T3;
  description: T3;
  slug: string;
  categoryId: string | null;
  price: string;
  compareAtPrice: string | null;
  status: 'ACTIVE' | 'HIDDEN' | 'ARCHIVED';
  lowStockThreshold: number | null;
  pointTextColor: string | null;
  pointBackgroundColor: string | null;
  quickSoldAt: string | null;
  completedAt: string | null;
  oneOffAt: string | null;
  labelsPrintedAt: string | null;
  version: number;
  createdAt: string;
  optionTypes: { id: string; key: string; name: T3 }[];
  optionNotes: { valueId: string; note: T3 }[];
  images: ImageView[];
  items: ItemView[];
  /** Codes shared by every item (open the picker). */
  sharedBarcodes: string[];
}

export interface ProductSummary {
  id: string;
  number: number;
  type: 'REGULAR' | 'VARIANT' | 'NUMBERED';
  name: T3;
  categoryId: string | null;
  price: string;
  minPrice: string;
  maxPrice: string;
  status: 'ACTIVE' | 'HIDDEN' | 'ARCHIVED';
  thumbnailUrl: string | null;
  itemCount: number;
  onHand: number;
  available: number;
  lowStock: boolean;
  needsCompletion: boolean;
  labelsPrintedAt: string | null;
}

export const labelsQuerySchema = z.object({
  productIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(500)),
  itemIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(500)),
});

/** One printable label: the code to encode, what to show and how many copies (pieces on hand). */
export interface LabelData {
  itemId: string;
  productId: string;
  sku: string;
  barcode: string;
  name: T3;
  options: T3[];
  price: string;
  onHand: number;
}
