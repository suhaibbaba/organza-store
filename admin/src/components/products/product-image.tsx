"use client";

import { useState } from "react";
import Image from "next/image";
import { PRODUCT_PLACEHOLDER_PATH } from "@/constants/images";
import { hasImageFailed, markImageFailed, resolveImageUrl } from "@/lib/image-fallback";
import type { ProductImageFit } from "@/types/product";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  /** cover = cropped list thumbnail; contain = whole photo on the plate; natural = no box, caller caps with max-h-*. */
  fit?: ProductImageFit;
  /** The one photo a screen is for: fetched eagerly at high priority instead of lazy-loaded. */
  eager?: boolean;
}

const NATURAL_IMAGE_CLASS = "h-auto w-auto max-w-full object-contain";

// No photo, a dead URL or a dropped load all land on the branded placeholder, never the broken-image glyph.
export function ProductImage({ src, alt, className, sizes, fit = "cover", eager = false }: ProductImageProps) {
  const resolved = src ? resolveImageUrl(src) : null;
  const contain = fit === "contain";

  // Keyed by URL so a row recycled onto another product doesn't inherit the last one's failure.
  const [failed, setFailed] = useState<string | null>(null);

  const usePlaceholder = !resolved || failed === resolved || hasImageFailed(resolved);
  const loading = eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {};

  // width/height 0 with h-auto w-auto tells next/image to use the photo's own size; srcset comes from `sizes`.
  if (fit === "natural") {
    return usePlaceholder ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={PRODUCT_PLACEHOLDER_PATH} alt="" className={cn(NATURAL_IMAGE_CLASS, className)} />
    ) : (
      <Image
        src={resolved}
        alt={alt}
        width={0}
        height={0}
        sizes={sizes ?? "96px"}
        {...loading}
        className={cn(NATURAL_IMAGE_CLASS, className)}
        onError={() => {
          markImageFailed(resolved);
          setFailed(resolved);
        }}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", contain ? "bg-sunken" : "bg-inset", className)}>
      {usePlaceholder ? (
        // Plain <img>: one SVG cached once by browser and service worker, not a per-size optimizer trip.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={PRODUCT_PLACEHOLDER_PATH} alt="" className="size-full object-cover" />
      ) : (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes ?? "96px"}
          {...loading}
          className={contain ? "object-contain" : "object-cover"}
          onError={() => {
            markImageFailed(resolved);
            setFailed(resolved);
          }}
        />
      )}
    </div>
  );
}
