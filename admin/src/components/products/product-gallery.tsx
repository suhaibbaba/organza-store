"use client";

import { useState } from "react";
import type { ProductImageRef } from "@shared/types/variant";
import { ProductImage } from "@/components/products/product-image";
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
      <ProductImage
        src={active?.url}
        alt={alt}
        className="aspect-square w-full rounded-xl"
        sizes="(min-width: 768px) 384px, 100vw"
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
                sizes="56px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
