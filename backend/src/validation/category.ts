import { z } from "zod";
import { i18nSchema } from "./common";

export const createCategorySchema = z.object({
  name: i18nSchema,
  parentId: z.string().min(1).optional().nullable(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: i18nSchema.optional(),
  parentId: z.string().min(1).optional().nullable(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
