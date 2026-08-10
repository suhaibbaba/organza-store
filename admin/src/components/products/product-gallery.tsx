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
      {/* The photo and nothing else: no card, no border, no plate behind it.
          It is drawn at its own shape and scaled down to fit — so a portrait
          shawl is exactly as wide as it is tall, with no empty bars either
          side of it, and a landscape one takes no more height than it needs.
          Capped by height, not given one: 16rem (18 from md up), and never
          more than 45vh on a short screen — a phone held sideways — so the
          photo can't push the price, the stock and the Edit button off the
          first screenful. Width is bounded by the max-w-sm column. */}
      <div className="flex justify-center">
        <ProductImage
          src={active?.url}
          alt={alt}
          fit="natural"
          className="max-h-[min(16rem,45vh)] md:max-h-[min(18rem,45vh)]"
          sizes={PRODUCT_DETAIL_IMAGE_SIZES}
        />
      </div>
      {/* The strip keeps its small even squares — they are an index of the
          photos, not the photo itself, and they carry no card or plate of
          their own: the only ring drawn is the one marking which photo is
          being shown. Left-aligned rather than centred on purpose: a centred
          scroll container puts its first item out of reach once there are
          more thumbnails than fit. */}
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
