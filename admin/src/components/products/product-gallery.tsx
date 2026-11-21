"use client";

import { useState } from "react";
import type { ProductImageRef } from "@organza/shared/types/variant";
import { ProductImage } from "@/components/products/product-image";
import { PRODUCT_DETAIL_IMAGE_SIZES, PRODUCT_DETAIL_THUMB_SIZES } from "@/constants/images";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: ProductImageRef[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div className="aspect-square w-full overflow-hidden rounded-panel bg-inset">
        <ProductImage
          src={active?.url}
          alt={alt}
          fit="contain"
          className="size-full"
          sizes={PRODUCT_DETAIL_IMAGE_SIZES}
          eager
        />
      </div>
      {/* Start-aligned on purpose: a centred scroll strip puts its first thumbnail out of reach. */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "shrink-0 overflow-hidden rounded-control ring-2 ring-offset-2 ring-offset-surface focus-darken",
                index === activeIndex ? "ring-primary-600" : "ring-transparent",
              )}
            >
              <ProductImage
                src={image.thumbnailUrl}
                alt={alt}
                className="size-14"
                sizes={PRODUCT_DETAIL_THUMB_SIZES}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
