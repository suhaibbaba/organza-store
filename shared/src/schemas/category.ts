import { z } from "zod";
import { i18nSchema } from "@/schemas/common";

export const createCategorySchema = z.object({
  name: i18nSchema,
  parentId: z.string().min(1).optional().nullable(),
  // Pins the category to the top of the POS product browser's sidebar.
  isFavorite: z.boolean().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: i18nSchema.optional(),
  parentId: z.string().min(1).optional().nullable(),
  isFavorite: z.boolean().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
