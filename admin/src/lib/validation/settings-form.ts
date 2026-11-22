import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@store/shared/constants/label";
import { IMPLEMENTED_SALE_NOTIFICATION_MODES } from "@store/shared/constants/push";
import { POS_AUTO_LOCK_MAX_MINUTES, POS_AUTO_LOCK_OFF } from "@store/shared/constants/posLock";
import type { Setting } from "@store/shared/types/setting";
import type { UpdateSettingInput } from "@store/shared/schemas/setting";
import { boundedDecimalField, boundedIntegerField, requiredIntegerField } from "@/lib/validation/numeric";

const i18nFormSchema = z.object({ ar: z.string(), en: z.string(), he: z.string() });

// Millimetres, bounded like the shared schema so a typo is caught here; margins and gaps may be 0.
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
  posAutoLockMinutes: boundedIntegerField(POS_AUTO_LOCK_OFF, POS_AUTO_LOCK_MAX_MINUTES),
  labelPrintMode: z.enum(LABEL_PRINT_MODES),
  labelWidthMm: labelDimensionField,
  labelHeightMm: labelDimensionField,
  // A4-only fields are still validated and saved in thermal mode, so switching back keeps the measured sheet.
  labelColumns: labelGridField,
  labelRows: labelGridField,
  labelPageMarginTopMm: labelMarginField,
  labelPageMarginRightMm: labelMarginField,
  labelPageMarginBottomMm: labelMarginField,
  labelPageMarginLeftMm: labelMarginField,
  labelGapXMm: labelGapField,
  labelGapYMm: labelGapField,
  // Only implemented modes are offered; a new mode appears here once it ships.
  saleNotificationsEnabled: z.boolean(),
  saleNotificationMode: z.enum(IMPLEMENTED_SALE_NOTIFICATION_MODES),
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function settingsToFormValues(setting: Setting): SettingsFormValues {
  return {
    storeName: { ar: setting.storeName.ar ?? "", en: setting.storeName.en ?? "", he: setting.storeName.he ?? "" },
    defaultLanguage: setting.defaultLanguage,
    defaultCountryCode: setting.defaultCountryCode,
    lowStockThreshold: String(setting.lowStockThreshold),
    posAutoLockMinutes: String(setting.posAutoLockMinutes),
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
    saleNotificationsEnabled: setting.saleNotificationsEnabled,
    // A mode from a newer build falls back to the first one this build understands.
    saleNotificationMode: IMPLEMENTED_SALE_NOTIFICATION_MODES.includes(
      setting.saleNotificationMode as (typeof IMPLEMENTED_SALE_NOTIFICATION_MODES)[number],
    )
      ? (setting.saleNotificationMode as SettingsFormValues["saleNotificationMode"])
      : IMPLEMENTED_SALE_NOTIFICATION_MODES[0],
  };
}

function sanitizeStoreName(value: SettingsFormValues["storeName"]): UpdateSettingInput["storeName"] {
  const entries = Object.entries(value)
    .map(([lang, text]) => [lang, text.trim()] as const)
    .filter(([, text]) => text.length > 0);
  return { ...Object.fromEntries(entries), ar: value.ar.trim() } as UpdateSettingInput["storeName"];
}

// Numeric fields are strings in the form and become numbers only on the way out.
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
    posAutoLockMinutes: toNumber(values.posAutoLockMinutes),
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
    saleNotificationsEnabled: values.saleNotificationsEnabled,
    saleNotificationMode: values.saleNotificationMode,
  };
}
