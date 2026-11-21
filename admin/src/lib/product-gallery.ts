import type { Product } from "@store/shared/types/product";
import { localize } from "@/lib/i18n-content";
import type { GalleryPhoto } from "@/types/product";

// Every photo of a product once: the numbered image first (it is what the shop shares), then its own photos, then the variants'.
export function buildGalleryPhotos(product: Product, locale: string): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  const seen = new Set<string>();
  if (product.markedImage) {
    photos.push({ id: "numbered", ...product.markedImage, kind: "numbered", variantName: null });
  }
  for (const image of product.images) {
    seen.add(image.id);
    photos.push({ id: image.id, url: image.url, mediumUrl: image.mediumUrl, thumbnailUrl: image.thumbnailUrl, kind: "product", variantName: null });
  }
  for (const variant of product.variants) {
    for (const image of variant.images) {
      if (seen.has(image.id)) continue;
      seen.add(image.id);
      photos.push({
        id: image.id,
        url: image.url,
        mediumUrl: image.mediumUrl,
        thumbnailUrl: image.thumbnailUrl,
        kind: "variant",
        variantName: localize(variant.name, locale),
      });
    }
  }
  return photos;
}
