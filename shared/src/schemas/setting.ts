import { z } from "zod";
import { i18nSchema } from "./common";
import { SUPPORTED_LANGUAGES } from "../constants/languages";

export const updateSettingSchema = z.object({
  storeName: i18nSchema.optional(),
  defaultLanguage: z.enum(SUPPORTED_LANGUAGES).optional(),
  supportedLanguages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1).optional(),
  currency: z.string().min(1).optional(),
  defaultCountryCode: z.string().min(1).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
