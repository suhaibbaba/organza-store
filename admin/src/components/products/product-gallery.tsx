"use client";

import { useState } from "react";
import type { ProductImageRef } from "@shared/types/variant";
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
      {/* A fixed, modest height rather than a square that grew with the
          screen: at aspect-square on a phone the photo was as tall as it was
          wide and pushed the price, the stock and the Edit button off the
          first screenful. Height is capped twice — a set height, plus 45vh
          for short screens (a phone held sideways) — and width by the
          max-w-sm on the column, so the photo can never dominate the page at
          either end. `contain` keeps whatever shape the photo actually is,
          centred on the white plate, instead of cropping the ends off a
          shawl to fill a square. */}
      <ProductImage
        src={active?.url}
        alt={alt}
        fit="contain"
        className="h-64 max-h-[45vh] w-full rounded-xl border border-border md:h-72"
        sizes={PRODUCT_DETAIL_IMAGE_SIZES}
      />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "shrink-0 overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-background",
                index === activeIndex ? "ring-primary" : "ring-transparent",
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
