"use client";

import { useState } from "react";
import Image from "next/image";
import { PRODUCT_PLACEHOLDER_PATH } from "@/constants/images";
import { hasImageFailed, markImageFailed, resolveImageUrl } from "@/lib/image-fallback";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}

/**
 * A product photo, or the branded placeholder standing in for one.
 *
 * There are three ways an image ends up with nothing to draw — the product
 * has no photo, the photo's URL is gone, or the network dropped mid-load —
 * and all three land on the same placeholder. What never appears is the
 * browser's broken-image glyph, which used to be the answer to the second and
 * third: it looks like the app is broken rather than like a product simply
 * hasn't been photographed yet.
 *
 * A URL that fails is remembered for the session (lib/image-fallback.ts), so
 * a list scrolled up and down doesn't re-request it once per row per render.
 *
 * Every image in the admin goes through here — lists, the detail gallery, the
 * order pickers, the label queue — so the fallback is one behaviour in one
 * place rather than a habit each screen has to remember.
 */
export function ProductImage({ src, alt, className, sizes }: ProductImageProps) {
  const resolved = src ? resolveImageUrl(src) : null;

  // Which URL *this* image has watched fail. Keyed by the URL rather than a
  // boolean so a row recycled onto a different product (the next page, a new
  // filter) starts fresh instead of inheriting the last one's failure.
  const [failed, setFailed] = useState<string | null>(null);

  const usePlaceholder = !resolved || failed === resolved || hasImageFailed(resolved);

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {usePlaceholder ? (
        // A plain <img>, not next/image: one flat SVG at one URL that the
        // browser and the service worker each cache once, rather than a
        // per-size trip through the optimizer that the worker is told not to
        // cache at all. Empty alt — the surrounding row already names the
        // product, and a second voice saying "no image" helps nobody.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={PRODUCT_PLACEHOLDER_PATH} alt="" className="size-full object-cover" />
      ) : (
        <Image
          src={resolved}
          alt={alt}
          fill
          sizes={sizes ?? "96px"}
          className="object-cover"
          onError={() => {
            markImageFailed(resolved);
            setFailed(resolved);
          }}
        />
      )}
    </div>
  );
}
