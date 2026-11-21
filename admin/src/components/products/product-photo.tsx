"use client";

import { ProductImage } from "@/components/products/product-image";
import type { ProductPhotoProps } from "@/types/product";

// A numbered shawl shows its burned-in photo, whole so no number is cut; any other piece shows its own photo.
export function ProductPhoto({ product, alt, className, sizes, fit }: ProductPhotoProps) {
  if (product.markedImage) {
    return <ProductImage src={product.markedImage.thumbnailUrl} alt={alt} className={className} sizes={sizes} fit="contain" />;
  }
  return <ProductImage src={product.image?.thumbnailUrl} alt={alt} className={className} sizes={sizes} fit={fit} />;
}
