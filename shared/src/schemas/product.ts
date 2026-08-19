import { z } from "zod";
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
import {
  DEFAULT_PRODUCT_COMPLETENESS_FILTER,
  PRODUCT_COMPLETENESS_FILTERS,
} from "@/constants/quickSell";
import { MAX_LABEL_PRINT_BATCH } from "@/constants/label";

// A supplier's own code, typed or scanned into a barcode field. Normalized
// before it is validated (see lib/barcode.ts) so the value stored is exactly
// what a scanner will send back at the counter, whatever the field collected.
export const supplierBarcodeInput = z
  .string()
  .transform(normalizeBarcode)
  .refine(isValidBarcode, { message: ERROR_CODES.BARCODE_INVALID });

// Where a piece's barcode comes from (CLAUDE.md rule 13 + constants/barcode.ts).
// Sent explicitly by the client rather than deduced from whether a code came
// with it: "use your own code" and "use this code the supplier printed" are
// two different intentions, and only one of them survives an empty field.
export const barcodeSourceInput = z.enum(BARCODE_SOURCES);

// The barcode half of a create/update body, shared by products and variants.
//   { barcodeSource: "SUPPLIER", barcode: "5901234123457" } — keep the tag
//     the garment came with.
//   { barcodeSource: "GENERATED" } — ours: minted on create, and on an edit
//     this switches back, restoring the code we had before (or minting a
//     fresh one if it is gone).
//   neither — leave whatever the piece already has alone.
export const barcodeFields = {
  barcodeSource: barcodeSourceInput.optional(),
  barcode: supplierBarcodeInput.optional(),
};

// A supplier source with nothing to put in it is the one combination that
// cannot be honoured, so it is refused by name instead of silently generating
// a code the garment does not carry. Applied to create and update alike.
export function refineBarcodeFields(value: {
  barcodeSource?: string;
  barcode?: string;
}): boolean {
  return value.barcodeSource !== BARCODE_SOURCE.SUPPLIER || typeof value.barcode === "string";
}

export const BARCODE_REFINEMENT = {
  message: ERROR_CODES.BARCODE_REQUIRED,
  path: ["barcode"] as (string | number)[],
};

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

// Numbered shawls (spec.md): the marker colours, stored on the product so a
// choice survives the photograph being replaced. Explicit null means "go back
// to following the photo" — which is why they are nullable rather than merely
// optional (omitted = leave alone).
export const pointColorFields = {
  pointTextColor: hexColorSchema.optional().nullable(),
  pointBackgroundColor: hexColorSchema.optional().nullable(),
};

// A note written against ONE of this product's option values (spec.md "Notes
// on a product's options"). Scoped to the product, never to the global value:
// the same "S" on the next product keeps whatever it had.
//
// The note itself is nullable, and null is meaningful — it REMOVES the note.
// Values not mentioned are left alone, so a caller can send one changed note
// without having to resend every note the product carries.
export const optionValueNoteInputSchema = z.object({
  optionValueId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  note: optionValueNoteSchema.nullable(),
});
export type OptionValueNoteInput = z.infer<typeof optionValueNoteInputSchema>;

export const optionValueNotesField = {
  optionValueNotes: z.array(optionValueNoteInputSchema).optional(),
};

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
  // Numbered product (spec.md "Numbered shawls"): one photo carrying numbers,
  // each number its own piece. Off by default; when on, the only variant type
  // the API accepts for this product is Number, and when off it accepts every
  // type except Number.
  isNumbered: z.boolean().optional(),
  // The colour of the numbers drawn on the photo and of the badge behind them
  // (spec.md "Numbered shawls"), one pair for the whole product. Omitted —
  // the usual case — the numbers follow the photo's own brightness instead.
  ...pointColorFields,
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // Auto-generation is the default (CLAUDE.md rule 13): omit these and the
  // product is given a fresh EAN-13. A product WITH variants may still carry
  // one here — a supplier's single code for every size lives on the parent.
  ...barcodeFields,
  // Selected global option values to generate variants from (cartesian
  // product across each type's valueIds). Omit for a simple product.
  optionSelections: z.array(optionSelectionSchema).optional(),
  // Optional short note per chosen value ("طول البنطلون ٩٥ سم" against this
  // product's own S). Only values this product actually uses are accepted.
  ...optionValueNotesField,
}).refine(refineBarcodeFields, BARCODE_REFINEMENT);
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
  // Changing which kind of product this is (see createProductSchema) is only
  // accepted while it has no variants at all — the API refuses the switch
  // rather than throwing away numbers or colours (error.product.
  // numbered_switch_has_variants).
  isNumbered: z.boolean().optional(),
  // Null puts either half back to "follow the photo"; a colour pins it, and
  // it stays pinned when the photograph is replaced.
  ...pointColorFields,
  sku: z.string().min(1).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  // Reversible in both directions, at any time (see barcodeFields).
  ...barcodeFields,
  // Upserted one by one: a note of `null` removes that value's note, and a
  // value left out of the list keeps whatever it had.
  ...optionValueNotesField,
}).refine(refineBarcodeFields, BARCODE_REFINEMENT);
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
  // Each variant's barcode is its own: one size can carry the supplier's tag
  // while the next still uses ours.
  ...barcodeFields,
}).refine(refineBarcodeFields, BARCODE_REFINEMENT);
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const listProductsQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  // Whether `categoryId` means that one category or the whole branch under
  // it. Off by default, which is what the admin's product filter has always
  // done ("show me exactly this shelf"); the POS product browser turns it on,
  // because a cashier tapping "Women" means every dress and abaya filed under
  // it and not the handful of products left directly on the parent.
  includeSubcategories: booleanInput.optional(),
  status: z.enum(["active", "hidden"]).optional(),
  stock: z.enum(["in_stock", "out_of_stock"]).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  q: z.string().min(1).optional(),
  // Barcode-label print state: "which labels still have to be printed" is a
  // whole workflow of its own, so it filters the list rather than being
  // sifted out client-side. Defaults to every product.
  printState: z.enum(PRODUCT_PRINT_STATES).default("all"),
  // Quick sell's own work queue (spec.md "Quick sell"). "needs_completing" is
  // the list an Admin has to clear once the season ends: sold, still without
  // a category, and therefore invisible to every category filter on this same
  // screen — which is exactly why it needs a filter of its own rather than a
  // note somebody is expected to remember.
  completeness: z.enum(PRODUCT_COMPLETENESS_FILTERS).default(DEFAULT_PRODUCT_COMPLETENESS_FILTER),
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
