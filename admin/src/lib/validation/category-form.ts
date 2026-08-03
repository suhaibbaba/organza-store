import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import type { CategoryNode } from "@shared/types/category";
import type { CreateCategoryInput, UpdateCategoryInput } from "@shared/schemas/category";

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Field messages are backend error codes (CLAUDE.md rule 12), same as the product form.
export const categoryFormSchema = z.object({
  name: i18nFormSchema.extend({ ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED) }),
  parentId: z.string(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const DEFAULT_CATEGORY_FORM_VALUES: CategoryFormValues = {
  name: { ar: "", en: "", he: "" },
  parentId: "",
};

function sanitizeName(value: CategoryFormValues["name"]): CreateCategoryInput["name"] {
  const entries = Object.entries(value)
    .map(([lang, text]) => [lang, text.trim()] as const)
    .filter(([, text]) => text.length > 0);
  return { ...Object.fromEntries(entries), ar: value.ar.trim() } as CreateCategoryInput["name"];
}

export function categoryToFormValues(category: CategoryNode): CategoryFormValues {
  return {
    name: { ar: category.name.ar ?? "", en: category.name.en ?? "", he: category.name.he ?? "" },
    parentId: category.parentId ?? "",
  };
}

export function toCreatePayload(values: CategoryFormValues): CreateCategoryInput {
  return { name: sanitizeName(values.name), parentId: values.parentId || undefined };
}

export function toUpdatePayload(values: CategoryFormValues): UpdateCategoryInput {
  return { name: sanitizeName(values.name), parentId: values.parentId || null };
}
