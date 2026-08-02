import { z } from "zod";
import { i18nSchema } from "@/schemas/common";

export const createVariantTypeSchema = z.object({
  name: i18nSchema,
});
export type CreateVariantTypeInput = z.infer<typeof createVariantTypeSchema>;

export const addOptionValueSchema = z.object({
  value: i18nSchema,
});
export type AddOptionValueInput = z.infer<typeof addOptionValueSchema>;
