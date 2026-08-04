import { z } from "zod";
import { i18nSchema } from "@/schemas/common";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@/constants/label";

// A label dimension in millimetres: a real piece of paper, so it has to be
// positive and can't be absurd.
const labelDimensionMm = z.coerce.number().min(LABEL_LIMITS.minDimensionMm).max(LABEL_LIMITS.maxDimensionMm);
// Margins and gaps may legitimately be 0 (edge-to-edge sticker sheets).
const labelSpacingMm = z.coerce.number().min(0).max(LABEL_LIMITS.maxMarginMm);
const labelGridCount = z.coerce.number().int().min(LABEL_LIMITS.minGridCount).max(LABEL_LIMITS.maxGridCount);

export const updateSettingSchema = z.object({
  storeName: i18nSchema.optional(),
  defaultLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
  supportedLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1).optional(),
  currency: z.string().min(1).optional(),
  defaultCountryCode: z.string().min(1).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  // --- barcode-label printing (any printer, hence nothing hard-coded) ---
  labelPrintMode: z.enum(LABEL_PRINT_MODES).optional(),
  labelWidthMm: labelDimensionMm.optional(),
  labelHeightMm: labelDimensionMm.optional(),
  // Grid/page fields are only read in A4_GRID mode, but stay editable in
  // either so switching modes doesn't lose the sheet the shop uses.
  labelColumns: labelGridCount.optional(),
  labelRows: labelGridCount.optional(),
  labelPageMarginTopMm: labelSpacingMm.optional(),
  labelPageMarginRightMm: labelSpacingMm.optional(),
  labelPageMarginBottomMm: labelSpacingMm.optional(),
  labelPageMarginLeftMm: labelSpacingMm.optional(),
  labelGapXMm: z.coerce.number().min(0).max(LABEL_LIMITS.maxGapMm).optional(),
  labelGapYMm: z.coerce.number().min(0).max(LABEL_LIMITS.maxGapMm).optional(),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
