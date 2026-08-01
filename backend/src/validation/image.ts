import { z } from "zod";

// An image belongs to exactly one owner — a product OR a variant, never both.
const ownerFields = {
  productId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
};

export const uploadImageSchema = z
  .object(ownerFields)
  .refine((v) => Boolean(v.productId) !== Boolean(v.variantId), {
    message: "error.image.owner_required",
  });
export type UploadImageInput = z.infer<typeof uploadImageSchema>;

export const reorderImagesSchema = z
  .object({
    ...ownerFields,
    imageIds: z.array(z.string().min(1)).min(1),
  })
  .refine((v) => Boolean(v.productId) !== Boolean(v.variantId), {
    message: "error.image.owner_required",
  })
  .refine((v) => new Set(v.imageIds).size === v.imageIds.length, {
    message: "error.image.reorder_duplicate",
  });
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;

export const setPrimaryImageSchema = z.object({
  isPrimary: z.boolean(),
});
export type SetPrimaryImageInput = z.infer<typeof setPrimaryImageSchema>;
