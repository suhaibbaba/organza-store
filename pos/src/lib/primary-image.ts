import type { ProductImageRef } from "@organza/shared/types/variant";

// The photo that stands for a product or a variant: the one marked primary,
// else the first by the shop's own order. Null when there are none — a
// variant with no photos of its own falls back to its product's (schema:
// "empty => falls back to product images"), and that is the caller's call.
export function primaryImage(images: readonly ProductImageRef[] | undefined): ProductImageRef | null {
  if (!images || images.length === 0) return null;
  return images.find((image) => image.isPrimary) ?? [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}
