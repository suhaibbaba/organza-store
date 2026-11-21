import type { ProductImageRef } from "@store/shared/types/variant";

// Primary, else first by the shop's order; null when none (a variant then falls back to its product).
export function primaryImage(images: readonly ProductImageRef[] | undefined): ProductImageRef | null {
  if (!images || images.length === 0) {
    return null;
  }
  return images.find((image) => image.isPrimary) ?? [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}
