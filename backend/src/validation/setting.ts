import { z } from "zod";
import { i18nSchema } from "./common";

export const updateSettingSchema = z.object({
  storeName: i18nSchema.optional(),
  defaultLanguage: z.enum(["ar", "en", "he"]).optional(),
  supportedLanguages: z.array(z.enum(["ar", "en", "he"])).min(1).optional(),
  currency: z.string().min(1).optional(),
  defaultCountryCode: z.string().min(1).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
