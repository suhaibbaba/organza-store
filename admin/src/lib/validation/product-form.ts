import { z } from "zod";
import { BARCODE_SOURCE, BARCODE_SOURCES } from "@store/shared/constants/barcode";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { isValidBarcode, normalizeBarcode } from "@store/shared/lib/barcode";
import type { I18n } from "@store/shared/types/common";
import type { Product } from "@store/shared/types/product";
import type { CreateProductInput, OptionValueNoteInput, UpdateProductInput } from "@store/shared/schemas/product";
import { optionalDecimalField, optionalIntegerField, requiredDecimalField } from "@/lib/validation/numeric";
import type { I18nFormValue, ProductEditAbilities } from "@/types/productForm";

// `ar` is required here, unlike the display I18n type.
type RequiredI18nInput = CreateProductInput["name"];
type OptionalI18nInput = NonNullable<CreateProductInput["description"]>;

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Messages are backend error codes (rule 12); stock is an integer, prices may have decimals.
export const productBasicFormSchema = z
  .object({
    name: i18nFormSchema.extend({ ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED) }),
    description: i18nFormSchema,
    categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
    basePrice: requiredDecimalField,
    compareAtPrice: optionalDecimalField,
    cost: optionalDecimalField,
    isActive: z.boolean(),
    trackLowStock: z.boolean(),
    // Asked first: it decides what the rest of the form shows.
    isNumbered: z.boolean(),
    stock: optionalIntegerField,
    // Ours by default (rule 13); `barcode` holds only a supplier's code.
    barcodeSource: z.enum(BARCODE_SOURCES),
    barcode: z.string(),
  })
  // So the message lands under the field, not as a failed save.
  .superRefine((values, ctx) => {
    if (values.barcodeSource !== BARCODE_SOURCE.SUPPLIER) {
      return;
    }
    const code = normalizeBarcode(values.barcode);
    if (code.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["barcode"], message: ERROR_CODES.BARCODE_REQUIRED });
      return;
    }
    if (!isValidBarcode(code)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["barcode"], message: ERROR_CODES.BARCODE_INVALID });
    }
  });
export type ProductBasicFormValues = z.infer<typeof productBasicFormSchema>;

export const DEFAULT_PRODUCT_FORM_VALUES: ProductBasicFormValues = {
  name: { ar: "", en: "", he: "" },
  description: { ar: "", en: "", he: "" },
  categoryId: "",
  basePrice: "",
  compareAtPrice: "",
  cost: "",
  isActive: true,
  trackLowStock: false,
  isNumbered: false,
  stock: "1",
  barcodeSource: BARCODE_SOURCE.GENERATED,
  barcode: "",
};

function sanitizeI18n(value: I18nFormValue): OptionalI18nInput | undefined {
  const entries = Object.entries(value)
    .map(([lang, text]) => [lang, text.trim()] as const)
    .filter(([, text]) => text.length > 0);
  return entries.length > 0 ? (Object.fromEntries(entries) as OptionalI18nInput) : undefined;
}

function sanitizeName(value: I18nFormValue): RequiredI18nInput {
  return { ...sanitizeI18n(value), ar: value.ar.trim() };
}

function toI18nRecord(value: I18n | null | undefined): I18nFormValue {
  return { ar: value?.ar ?? "", en: value?.en ?? "", he: value?.he ?? "" };
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function productToFormValues(product: Product): ProductBasicFormValues {
  return {
    name: toI18nRecord(product.name),
    description: toI18nRecord(product.description),
    categoryId: product.category?.id ?? "",
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice ?? "",
    cost: product.cost ?? "",
    isActive: product.isActive,
    trackLowStock: product.trackLowStock,
    isNumbered: product.isNumbered,
    stock: product.hasVariants ? "" : String(product.stock ?? 1),
    barcodeSource: product.barcodeSource,
    // Only a supplier code is editable; ours shows read-only.
    barcode: product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? (product.barcode ?? "") : "",
  };
}

// An explicit source plus, for a supplier, the code: never a bare code to guess at.
function barcodePayload(values: ProductBasicFormValues) {
  return values.barcodeSource === BARCODE_SOURCE.SUPPLIER
    ? { barcodeSource: BARCODE_SOURCE.SUPPLIER, barcode: normalizeBarcode(values.barcode) }
    : { barcodeSource: BARCODE_SOURCE.GENERATED };
}

export function toCreatePayload(
  values: ProductBasicFormValues,
  optionSelections: { variantTypeId: string; valueIds: string[] }[],
  optionValueNotes: OptionValueNoteInput[] = [],
): CreateProductInput {
  const hasVariants = optionSelections.length > 0;
  return {
    name: sanitizeName(values.name),
    description: sanitizeI18n(values.description),
    categoryId: values.categoryId,
    basePrice: values.basePrice.trim(),
    compareAtPrice: emptyToUndefined(values.compareAtPrice),
    cost: emptyToUndefined(values.cost),
    isActive: values.isActive,
    trackLowStock: values.trackLowStock,
    isNumbered: values.isNumbered,
    stock: hasVariants ? undefined : Number(emptyToUndefined(values.stock) ?? "1"),
    // A supplier's single code for every size lives on the parent; scanning it opens the picker.
    ...barcodePayload(values),
    optionSelections: hasVariants ? optionSelections : undefined,
    optionValueNotes: optionValueNotes.length > 0 ? optionValueNotes : undefined,
  };
}

// Only fields this user may write: echoing an unseen cost back could clear it.
export function toUpdatePayload(
  values: ProductBasicFormValues,
  hasVariants: boolean,
  abilities: ProductEditAbilities,
  // Only changed notes; a cleared one is an explicit null.
  optionValueNotes: OptionValueNoteInput[] = [],
): UpdateProductInput {
  return {
    name: sanitizeName(values.name),
    description: sanitizeI18n(values.description) ?? null,
    categoryId: values.categoryId,
    basePrice: abilities.canEditPrice ? values.basePrice.trim() : undefined,
    compareAtPrice: abilities.canEditPrice ? emptyToNull(values.compareAtPrice) : undefined,
    cost: abilities.canEditCost ? emptyToNull(values.cost) : undefined,
    isActive: abilities.canHide ? values.isActive : undefined,
    trackLowStock: abilities.canEditStock ? values.trackLowStock : undefined,
    // Always sent: the API refuses a real change only while variants exist.
    isNumbered: values.isNumbered,
    stock: hasVariants || !abilities.canEditStock ? undefined : Number(emptyToUndefined(values.stock) ?? "1"),
    // Always sent: unchanged writes nothing, and GENERATED restores our previous code.
    ...barcodePayload(values),
    optionValueNotes: optionValueNotes.length > 0 ? optionValueNotes : undefined,
  };
}
