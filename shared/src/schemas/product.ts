import { z } from "zod";
import { decimalInput, i18nOptionalSchema, i18nSchema, imagePointCoordinateSchema, paginationSchema } from "@/schemas/common";
import { ERROR_CODES } from "@/constants/errors";
import { PRODUCT_PRINT_STATES, PRODUCT_SORT_FIELDS } from "@/constants/product";
import { MAX_LABEL_PRINT_BATCH } from "@/constants/label";

// Numbered shawls (spec.md): a point on the product image for one option
// value, set while the admin is placing/reviewing points, before Save.
export const imagePointSchema = z.object({
  imageX: imagePointCoordinateSchema,
  imageY: imagePointCoordinateSchema,
});

export const optionSelectionSchema = z.object({
  variantTypeId: z.string().min(1),
  valueIds: z.array(z.string().min(1)).min(1),
  // Optional per-value image point, keyed by valueId (numbered shawls only;
  // ordinary Color/Size selections simply omit this).
  imagePoints: z.record(z.string(), imagePointSchema).optional(),
});

export const createProductSchema = z.object({
  name: i18nSchema,
  description: i18nOptionalSchema.optional(),
  categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  basePrice: decimalInput,
  compareAtPrice: decimalInput.optional(),
  cost: decimalInput.optional(),
  isActive: z.boolean().optional(),
  // Opt-in low-stock alerts (CLAUDE.md rule 14: the threshold itself still
  // comes from Setting). Off by default — most products are one-off pieces
  // with stock = 1, so alerting on all of them is noise.
  trackLowStock: z.boolean().optional(),
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // Selected global option values to generate variants from (cartesian
  // product across each type's valueIds). Omit for a simple product.
  optionSelections: z.array(optionSelectionSchema).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: i18nSchema.optional(),
  description: i18nOptionalSchema.optional().nullable(),
  categoryId: z.string().min(1).optional(),
  basePrice: decimalInput.optional(),
  compareAtPrice: decimalInput.optional().nullable(),
  cost: decimalInput.optional().nullable(),
  isActive: z.boolean().optional(),
  trackLowStock: z.boolean().optional(),
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const generateVariantsSchema = z.object({
  optionSelections: z.array(optionSelectionSchema).min(1),
});
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;

export const updateVariantSchema = z.object({
  name: i18nSchema.optional(),
  sku: z.string().min(1).optional(),
  priceOverride: decimalInput.optional().nullable(),
  cost: decimalInput.optional().nullable(),
  stock: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  // Numbered shawls (spec.md): point on the product image, percentage 0-100.
  // Null clears it back to an ordinary variant.
  imageX: imagePointCoordinateSchema.optional().nullable(),
  imageY: imagePointCoordinateSchema.optional().nullable(),
});
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const listProductsQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  stock: z.enum(["in_stock", "out_of_stock"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  q: z.string().min(1).optional(),
  // Barcode-label print state: "which labels still have to be printed" is a
  // whole workflow of its own, so it filters the list rather than being
  // sifted out client-side. Defaults to every product.
  printState: z.enum(PRODUCT_PRINT_STATES).default("all"),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// POST /api/products/labels/printed — record that a batch of labels went to
// the printer. Bounded like every other list the API takes (CLAUDE.md rule
// 15); reprinting the same products later is always allowed.
export const markLabelsPrintedSchema = z.object({
  productIds: z
    .array(z.string().min(1))
    .min(1, ERROR_CODES.VALIDATION_REQUIRED)
    .max(MAX_LABEL_PRINT_BATCH),
});
export type MarkLabelsPrintedInput = z.infer<typeof markLabelsPrintedSchema>;

// POS barcode/SKU lookup (GET /api/products/lookup). One scan of a tag has
// to resolve to the exact thing being sold, so the code is matched against
// both products and variants, and both of their identifiers: the barcode is
// what the label prints (CLAUDE.md rule 13), the SKU is what a staff member
// reads out when a label is damaged.
export const lookupProductQuerySchema = z.object({
  code: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
});
export type LookupProductQuery = z.infer<typeof lookupProductQuerySchema>;
