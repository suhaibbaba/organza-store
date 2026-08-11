import { z } from "zod";
import { BARCODE_SOURCE, BARCODE_SOURCES } from "@organza/shared/constants/barcode";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { isValidBarcode, normalizeBarcode } from "@organza/shared/lib/barcode";
import type { I18n } from "@organza/shared/types/common";
import type { Product } from "@organza/shared/types/product";
import type { CreateProductInput, UpdateProductInput } from "@organza/shared/schemas/product";
import { optionalDecimalField, optionalIntegerField, requiredDecimalField } from "@/lib/validation/numeric";
import type { I18nFormValue, ProductEditAbilities } from "@/types/productForm";

// The exact { ar: string; en?: string; he?: string } shape the shared
// create/update schemas require for `name` — narrower than the generic
// `I18n` display type, since `ar` must always be present here.
type RequiredI18nInput = CreateProductInput["name"];
type OptionalI18nInput = NonNullable<CreateProductInput["description"]>;

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Field messages are backend error codes (CLAUDE.md rule 12), same as every
// other form — see useTranslateError. Stock is an integer (no decimals);
// prices may keep a decimal point (CLAUDE.md "Mobile input" rules).
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
    // Which kind of product this is (spec.md "Numbered shawls") — asked first,
    // because it decides what the rest of the form shows.
    isNumbered: z.boolean(),
    stock: optionalIntegerField,
    // Ours by default (CLAUDE.md rule 13), or the code the garment arrived
    // carrying. `barcode` holds the supplier's code only — the generated one is
    // never typed by hand.
    barcodeSource: z.enum(BARCODE_SOURCES),
    barcode: z.string(),
  })
  // Checked here as well as on the backend so the message lands under the
  // field the user is looking at, rather than as a whole-form failure after a
  // round trip.
  .superRefine((values, ctx) => {
    if (values.barcodeSource !== BARCODE_SOURCE.SUPPLIER) return;
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
  // Generation is the default, so nothing changes for a piece that arrives
  // with no code on it.
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
    // Only a supplier code belongs in the editable box; ours is shown
    // read-only from the product itself.
    barcode: product.barcodeSource === BARCODE_SOURCE.SUPPLIER ? product.barcode ?? "" : "",
  };
}

// The barcode half of a create/update body. Sent as an explicit source plus,
// for a supplier code, the code itself — never as a bare code the API would
// have to guess the meaning of.
function barcodePayload(values: ProductBasicFormValues) {
  return values.barcodeSource === BARCODE_SOURCE.SUPPLIER
    ? { barcodeSource: BARCODE_SOURCE.SUPPLIER, barcode: normalizeBarcode(values.barcode) }
    : { barcodeSource: BARCODE_SOURCE.GENERATED };
}

export function toCreatePayload(
  values: ProductBasicFormValues,
  optionSelections: { variantTypeId: string; valueIds: string[] }[]
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
    // A product with variants may carry one too: a supplier's single code for
    // every size lives on the parent, and scanning it opens the picker.
    ...barcodePayload(values),
    optionSelections: hasVariants ? optionSelections : undefined,
  };
}

// Only the fields this user may write are sent (see ProductEditAbilities):
// the form still holds a price and a cost for everyone, but an Employee's
// copy of them is either read-only or never loaded at all, so echoing them
// back would at best be refused and at worst clear a cost they can't see.
export function toUpdatePayload(
  values: ProductBasicFormValues,
  hasVariants: boolean,
  abilities: ProductEditAbilities
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
    // Always sent, never diffed here: the API compares it against what is
    // stored and only refuses a real change on a product that still has
    // variants (error.product.numbered_switch_has_variants).
    isNumbered: values.isNumbered,
    stock: hasVariants || !abilities.canEditStock ? undefined : Number(emptyToUndefined(values.stock) ?? "1"),
    // Always sent, and safe to resend: the API compares it against what is
    // stored, so an unchanged answer writes nothing, and switching back to
    // GENERATED restores the code we had before rather than minting a new one.
    ...barcodePayload(values),
  };
}
