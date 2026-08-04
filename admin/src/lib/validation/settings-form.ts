import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@shared/constants/label";
import type { Setting } from "@shared/types/setting";
import type { UpdateSettingInput } from "@shared/schemas/setting";
import { boundedDecimalField, boundedIntegerField, requiredIntegerField } from "@/lib/validation/numeric";

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Label geometry, in millimetres, bounded exactly like the shared schema the
// backend validates with (shared/src/constants/label.ts) so a typo is caught
// on the phone instead of coming back as a rejected save. Margins and gaps
// may be 0 — sticker sheets that start at the paper edge are normal.
const labelDimensionField = boundedDecimalField(LABEL_LIMITS.minDimensionMm, LABEL_LIMITS.maxDimensionMm);
const labelMarginField = boundedDecimalField(0, LABEL_LIMITS.maxMarginMm);
const labelGapField = boundedDecimalField(0, LABEL_LIMITS.maxGapMm);
const labelGridField = boundedIntegerField(LABEL_LIMITS.minGridCount, LABEL_LIMITS.maxGridCount);

// Field messages are backend error codes (CLAUDE.md rule 12), same as every other form.
export const settingsFormSchema = z.object({
  storeName: i18nFormSchema.extend({ ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED) }),
  defaultLanguage: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  defaultCountryCode: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  lowStockThreshold: requiredIntegerField,
  labelPrintMode: z.enum(LABEL_PRINT_MODES),
  labelWidthMm: labelDimensionField,
  labelHeightMm: labelDimensionField,
  // The grid/page fields describe the A4 sheet only, but they are validated
  // and saved in either mode so switching to thermal and back doesn't lose
  // the sheet the shop measured.
  labelColumns: labelGridField,
  labelRows: labelGridField,
  labelPageMarginTopMm: labelMarginField,
  labelPageMarginRightMm: labelMarginField,
  labelPageMarginBottomMm: labelMarginField,
  labelPageMarginLeftMm: labelMarginField,
  labelGapXMm: labelGapField,
  labelGapYMm: labelGapField,
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function settingsToFormValues(setting: Setting): SettingsFormValues {
  return {
    storeName: { ar: setting.storeName.ar ?? "", en: setting.storeName.en ?? "", he: setting.storeName.he ?? "" },
    defaultLanguage: setting.defaultLanguage,
    defaultCountryCode: setting.defaultCountryCode,
    lowStockThreshold: String(setting.lowStockThreshold),
    labelPrintMode: setting.labelPrintMode,
    labelWidthMm: String(setting.labelWidthMm),
    labelHeightMm: String(setting.labelHeightMm),
    labelColumns: String(setting.labelColumns),
    labelRows: String(setting.labelRows),
    labelPageMarginTopMm: String(setting.labelPageMarginTopMm),
    labelPageMarginRightMm: String(setting.labelPageMarginRightMm),
    labelPageMarginBottomMm: String(setting.labelPageMarginBottomMm),
    labelPageMarginLeftMm: String(setting.labelPageMarginLeftMm),
    labelGapXMm: String(setting.labelGapXMm),
    labelGapYMm: String(setting.labelGapYMm),
  };
}

function sanitizeStoreName(value: SettingsFormValues["storeName"]): UpdateSettingInput["storeName"] {
  const entries = Object.entries(value)
    .map(([lang, text]) => [lang, text.trim()] as const)
    .filter(([, text]) => text.length > 0);
  return { ...Object.fromEntries(entries), ar: value.ar.trim() } as UpdateSettingInput["storeName"];
}

// Numeric fields are held as strings in the form (mobile numeric inputs, see
// components/ui/numeric-input.tsx) and only become numbers on the way out.
function toNumber(value: string): number {
  return Number(value.trim());
}

// currency is intentionally excluded (spec.md: fixed for Phase 1, not editable here).
export function toUpdatePayload(values: SettingsFormValues): UpdateSettingInput {
  return {
    storeName: sanitizeStoreName(values.storeName),
    defaultLanguage: values.defaultLanguage as UpdateSettingInput["defaultLanguage"],
    defaultCountryCode: values.defaultCountryCode.trim(),
    lowStockThreshold: toNumber(values.lowStockThreshold),
    labelPrintMode: values.labelPrintMode,
    labelWidthMm: toNumber(values.labelWidthMm),
    labelHeightMm: toNumber(values.labelHeightMm),
    labelColumns: toNumber(values.labelColumns),
    labelRows: toNumber(values.labelRows),
    labelPageMarginTopMm: toNumber(values.labelPageMarginTopMm),
    labelPageMarginRightMm: toNumber(values.labelPageMarginRightMm),
    labelPageMarginBottomMm: toNumber(values.labelPageMarginBottomMm),
    labelPageMarginLeftMm: toNumber(values.labelPageMarginLeftMm),
    labelGapXMm: toNumber(values.labelGapXMm),
    labelGapYMm: toNumber(values.labelGapYMm),
  };
}
