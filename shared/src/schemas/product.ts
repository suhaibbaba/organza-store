import { z } from "zod";
import { QUANTITY_MAX } from "@/constants/quantity";
import {
  booleanInput,
  decimalInput,
  hexColorSchema,
  i18nOptionalSchema,
  i18nSchema,
  optionValueNoteSchema,
  imagePointCoordinateSchema,
  paginationSchema,
} from "@/schemas/common";
import { BARCODE_SOURCE, BARCODE_SOURCES } from "@/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@/lib/barcode";
import { ERROR_CODES } from "@/constants/errors";
import { PRODUCT_PRINT_STATES, PRODUCT_SORT_FIELDS } from "@/constants/product";
import { DEFAULT_PRODUCT_COMPLETENESS_FILTER, PRODUCT_COMPLETENESS_FILTERS } from "@/constants/quickSell";
import { MAX_LABEL_PRINT_BATCH } from "@/constants/label";

// Normalized before validation (lib/barcode.ts), so what is stored is what a scanner sends back.
export const supplierBarcodeInput = z
  .string()
  .transform(normalizeBarcode)
  .refine(isValidBarcode, { message: ERROR_CODES.BARCODE_INVALID });

// Sent explicitly, never deduced from the code (rule 13): own code and supplier code are different intentions.
export const barcodeSourceInput = z.enum(BARCODE_SOURCES);

// SUPPLIER + barcode keeps the garment's tag; GENERATED mints ours or restores it; neither leaves the piece alone.
export const barcodeFields = {
  barcodeSource: barcodeSourceInput.optional(),
  barcode: supplierBarcodeInput.optional(),
};

// A supplier source with no code is refused rather than silently generating one.
export function refineBarcodeFields(value: { barcodeSource?: string; barcode?: string }): boolean {
  return value.barcodeSource !== BARCODE_SOURCE.SUPPLIER || typeof value.barcode === "string";
}

export const BARCODE_REFINEMENT = {
  message: ERROR_CODES.BARCODE_REQUIRED,
  path: ["barcode"] as (string | number)[],
};

// Numbered shawls (spec.md): a point on the product image for one option value.
export const imagePointSchema = z.object({
  imageX: imagePointCoordinateSchema,
  imageY: imagePointCoordinateSchema,
});

export const comboStockSchema = z.object({
  valueIds: z.array(z.string().min(1)).min(1),
  stock: z.coerce.number().int().min(0).max(QUANTITY_MAX),
});
export type ComboStockInput = z.infer<typeof comboStockSchema>;

export const optionSelectionSchema = z.object({
  variantTypeId: z.string().min(1),
  valueIds: z.array(z.string().min(1)).min(1),
  imagePoints: z.record(z.string(), imagePointSchema).optional(),
});

// Numbered-shawl marker colours on the product; null means follow the photo again, omitted means leave alone.
export const pointColorFields = {
  pointTextColor: hexColorSchema.optional().nullable(),
  pointBackgroundColor: hexColorSchema.optional().nullable(),
};

// A note on one of this product's option values, never the global value; null removes it, unmentioned values are kept.
export const optionValueNoteInputSchema = z.object({
  optionValueId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  note: optionValueNoteSchema.nullable(),
});
export type OptionValueNoteInput = z.infer<typeof optionValueNoteInputSchema>;

export const optionValueNotesField = {
  optionValueNotes: z.array(optionValueNoteInputSchema).optional(),
};

export const createProductSchema = z
  .object({
    name: i18nSchema,
    description: i18nOptionalSchema.optional(),
    categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    basePrice: decimalInput,
    compareAtPrice: decimalInput.optional(),
    cost: decimalInput.optional(),
    isActive: z.boolean().optional(),
    // Opt-in low-stock alerts (threshold from Setting, rule 14); off by default because most pieces are one-offs at 1.
    trackLowStock: z.boolean().optional(),
    // Numbered product (spec.md "Numbered shawls"): when on, only the Number variant type is accepted; when off, everything but Number.
    isNumbered: z.boolean().optional(),
    // Marker and badge colours for the whole product; omitted, they follow the photo's brightness.
    ...pointColorFields,
    sku: z.string().min(1).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    // Omit for an auto-generated EAN-13 (rule 13); a parent may carry one supplier code shared by every variant.
    ...barcodeFields,
    // Option values to build variants from (cartesian across types); omit for a simple product.
    optionSelections: z.array(optionSelectionSchema).optional(),
    comboStocks: z.array(comboStockSchema).optional(),
    // Optional note per chosen value; only values this product uses are accepted.
    ...optionValueNotesField,
  })
  .refine(refineBarcodeFields, BARCODE_REFINEMENT);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: i18nSchema.optional(),
    description: i18nOptionalSchema.optional().nullable(),
    categoryId: z.string().min(1).optional(),
    basePrice: decimalInput.optional(),
    compareAtPrice: decimalInput.optional().nullable(),
    cost: decimalInput.optional().nullable(),
    isActive: z.boolean().optional(),
    trackLowStock: z.boolean().optional(),
    // Switching numbered/ordinary is refused once the product has variants (error.product.numbered_switch_has_variants).
    isNumbered: z.boolean().optional(),
    // Null returns a colour to following the photo; a set colour survives a new photo.
    ...pointColorFields,
    sku: z.string().min(1).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    // Reversible in both directions, at any time (see barcodeFields).
    ...barcodeFields,
    // Upserted one by one: null removes a note, omitted values keep theirs.
    ...optionValueNotesField,
  })
  .refine(refineBarcodeFields, BARCODE_REFINEMENT);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const generateVariantsSchema = z.object({
  optionSelections: z.array(optionSelectionSchema).min(1),
  comboStocks: z.array(comboStockSchema).optional(),
});
export type GenerateVariantsInput = z.infer<typeof generateVariantsSchema>;

export const updateVariantSchema = z
  .object({
    name: i18nSchema.optional(),
    sku: z.string().min(1).optional(),
    priceOverride: decimalInput.optional().nullable(),
    cost: decimalInput.optional().nullable(),
    stock: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    // Numbered-shawl point as a percentage 0-100; null makes it an ordinary variant.
    imageX: imagePointCoordinateSchema.optional().nullable(),
    imageY: imagePointCoordinateSchema.optional().nullable(),
    // Each variant's barcode source is its own.
    ...barcodeFields,
  })
  .refine(refineBarcodeFields, BARCODE_REFINEMENT);
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const listProductsQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  // Whether categoryId includes its whole branch: off for the admin's exact-shelf filter, on for the POS.
  includeSubcategories: booleanInput.optional(),
  status: z.enum(["active", "hidden"]).optional(),
  stock: z.enum(["in_stock", "out_of_stock"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  q: z.string().min(1).optional(),
  // Label print state is filtered on the server: "still to print" is a workflow of its own.
  printState: z.enum(PRODUCT_PRINT_STATES).default("all"),
  // Quick sell's queue (spec.md): needs_completing finds sold, categoryless products no category filter can reach.
  completeness: z.enum(PRODUCT_COMPLETENESS_FILTERS).default(DEFAULT_PRODUCT_COMPLETENESS_FILTER),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// Records a printed batch; bounded like every list (rule 15), reprinting always allowed.
export const markLabelsPrintedSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1, ERROR_CODES.VALIDATION_REQUIRED).max(MAX_LABEL_PRINT_BATCH),
});
export type MarkLabelsPrintedInput = z.infer<typeof markLabelsPrintedSchema>;

// POS lookup: one scan resolves to the exact piece, matched on product and variant barcodes (rule 13) and SKUs.
export const lookupProductQuerySchema = z.object({
  code: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
});
export type LookupProductQuery = z.infer<typeof lookupProductQuerySchema>;
