import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import type { Setting } from "@shared/types/setting";
import type { UpdateSettingInput } from "@shared/schemas/setting";
import { requiredIntegerField } from "@/lib/validation/numeric";

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Field messages are backend error codes (CLAUDE.md rule 12), same as every other form.
export const settingsFormSchema = z.object({
  storeName: i18nFormSchema.extend({ ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED) }),
  defaultLanguage: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  defaultCountryCode: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  lowStockThreshold: requiredIntegerField,
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function settingsToFormValues(setting: Setting): SettingsFormValues {
  return {
    storeName: { ar: setting.storeName.ar ?? "", en: setting.storeName.en ?? "", he: setting.storeName.he ?? "" },
    defaultLanguage: setting.defaultLanguage,
    defaultCountryCode: setting.defaultCountryCode,
    lowStockThreshold: String(setting.lowStockThreshold),
  };
}

function sanitizeStoreName(value: SettingsFormValues["storeName"]): UpdateSettingInput["storeName"] {
  const entries = Object.entries(value)
    .map(([lang, text]) => [lang, text.trim()] as const)
    .filter(([, text]) => text.length > 0);
  return { ...Object.fromEntries(entries), ar: value.ar.trim() } as UpdateSettingInput["storeName"];
}

// currency is intentionally excluded (spec.md: fixed for Phase 1, not editable here).
export function toUpdatePayload(values: SettingsFormValues): UpdateSettingInput {
  return {
    storeName: sanitizeStoreName(values.storeName),
    defaultLanguage: values.defaultLanguage as UpdateSettingInput["defaultLanguage"],
    defaultCountryCode: values.defaultCountryCode.trim(),
    lowStockThreshold: Number(values.lowStockThreshold.trim()),
  };
}
