import { z } from "zod";
import { imageEditSchema } from "@organza/shared/schemas/image";
import { ERROR_CODES } from "@/constants";

/**
 * The editor's crop, as it survives a multipart upload.
 *
 * Everything else in a multipart body is a plain string, and so is this: the
 * admin sends the edit as JSON in a text field beside the file. Parsed here
 * rather than in the route so that a malformed one is a validation failure
 * like any other — the shape it must parse INTO is shared with the re-crop
 * endpoint and with the geometry that reads it (CLAUDE.md rule 8).
 */
const jsonImageEdit = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    // Left as the unparseable string; the object schema below refuses it and
    // the caller gets error.validation rather than a 500.
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
    // Optional throughout: a photo uploaded without opening the editor is a
    // supported way to add one, and is stored whole exactly as it always was.
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

// PATCH /api/images/:id/edit — cut the same photograph differently, from the
// original kept beside it. JSON, not multipart: there is no file, which is
// the whole point of having kept one.
export const editImageSchema = z.object({ edit: imageEditSchema });
export type EditImageInput = z.infer<typeof editImageSchema>;
