import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import type { I18n } from "@shared/types/common";
import type { Product } from "@shared/types/product";
import type { CreateProductInput, UpdateProductInput } from "@shared/schemas/product";
import { optionalDecimalField, optionalIntegerField, requiredDecimalField } from "@/lib/validation/numeric";
import type { I18nFormValue } from "@/types/productForm";

// The exact { ar: string; en?: string; he?: string } shape the shared
// create/update schemas require for `name` — narrower than the generic
// `I18n` display type, since `ar` must always be present here.
type RequiredI18nInput = CreateProductInput["name"];
type OptionalI18nInput = NonNullable<CreateProductInput["description"]>;

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Field messages are backend error codes (CLAUDE.md rule 12), same as every
// other form — see useTranslateError. Stock is an integer (no decimals);
// prices may keep a decimal point (CLAUDE.md "Mobile input" rules).
export const productBasicFormSchema = z.object({
  name: i18nFormSchema.extend({ ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED) }),
  description: i18nFormSchema,
  categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  basePrice: requiredDecimalField,
  compareAtPrice: optionalDecimalField,
  cost: optionalDecimalField,
  isActive: z.boolean(),
  stock: optionalIntegerField,
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
  stock: "1",
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
    stock: product.hasVariants ? "" : String(product.stock ?? 1),
  };
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
    stock: hasVariants ? undefined : Number(emptyToUndefined(values.stock) ?? "1"),
    optionSelections: hasVariants ? optionSelections : undefined,
  };
}

export function toUpdatePayload(values: ProductBasicFormValues, hasVariants: boolean): UpdateProductInput {
  return {
    name: sanitizeName(values.name),
    description: sanitizeI18n(values.description) ?? null,
    categoryId: values.categoryId,
    basePrice: values.basePrice.trim(),
    compareAtPrice: emptyToNull(values.compareAtPrice),
    cost: emptyToNull(values.cost),
    isActive: values.isActive,
    stock: hasVariants ? undefined : Number(emptyToUndefined(values.stock) ?? "1"),
  };
}
