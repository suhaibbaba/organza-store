"use client";

import { useState } from "react";
import Image from "next/image";
import { PRODUCT_PLACEHOLDER_PATH } from "@/constants/images";
import { hasImageFailed, markImageFailed, resolveImageUrl } from "@/lib/image-fallback";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  fit?: "cover" | "contain";
}

// A product photo, or the branded placeholder for a missing or failed one — never the broken-image glyph.
export function ProductThumb({ src, alt, className, sizes, fit = "cover" }: ProductThumbProps) {
  const resolved = src ? resolveImageUrl(src) : null;

  // Keyed by URL so a row recycled onto a different product starts fresh.
  const [failed, setFailed] = useState<string | null>(null);

  const usePlaceholder = !resolved || failed === resolved || hasImageFailed(resolved);

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-sunken", className)}>
      {usePlaceholder ? (
        // A plain <img>: one flat SVG cached once by browser and service worker, not a per-size optimizer trip.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={PRODUCT_PLACEHOLDER_PATH} alt="" className="size-full object-cover" />
      ) : (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes ?? "80px"}
          className={fit === "contain" ? "object-contain" : "object-cover"}
          onError={() => {
            markImageFailed(resolved);
            setFailed(resolved);
          }}
        />
      )}
    </div>
  );
}
