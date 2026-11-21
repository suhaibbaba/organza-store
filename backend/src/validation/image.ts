import { z } from "zod";
import { imageEditSchema } from "@store/shared/schemas/image";
import { ERROR_CODES } from "@/constants";

/** The editor's crop arrives as JSON in a multipart text field, parsed here so a bad one is a validation failure. */
const jsonImageEdit = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    // Left as the raw string, so the schema below refuses it as error.validation, not a 500.
    return value;
  }
}, imageEditSchema);

// An image belongs to exactly one owner — a product OR a variant, never both.
const ownerFields = {
  productId: z.string().min(1).optional(),
  variantId: z.string().min(1).optional(),
};

export const uploadImageSchema = z
  .object({
    ...ownerFields,
    // Optional: a photo uploaded without the editor is stored whole.
    edit: jsonImageEdit.optional(),
  })
  .refine((v) => Boolean(v.productId) !== Boolean(v.variantId), {
    message: ERROR_CODES.IMAGE_OWNER_REQUIRED,
  });
export type UploadImageInput = z.infer<typeof uploadImageSchema>;

export const reorderImagesSchema = z
  .object({
    ...ownerFields,
    imageIds: z.array(z.string().min(1)).min(1),
  })
  .refine((v) => Boolean(v.productId) !== Boolean(v.variantId), {
    message: ERROR_CODES.IMAGE_OWNER_REQUIRED,
  })
  .refine((v) => new Set(v.imageIds).size === v.imageIds.length, {
    message: ERROR_CODES.IMAGE_REORDER_DUPLICATE,
  });
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;

export const setPrimaryImageSchema = z.object({
  isPrimary: z.boolean(),
});
export type SetPrimaryImageInput = z.infer<typeof setPrimaryImageSchema>;

// PATCH /api/images/:id/edit — re-cut from the kept original; JSON, since there is no file.
export const editImageSchema = z.object({ edit: imageEditSchema });
export type EditImageInput = z.infer<typeof editImageSchema>;
