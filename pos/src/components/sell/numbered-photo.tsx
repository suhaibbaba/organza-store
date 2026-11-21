"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import { resolvePointColors } from "@store/shared/lib/pointColors";
import {
  POINT_MARKER_ASPECT_RATIO,
  POINT_MARKER_BORDER_PERCENT,
  POINT_MARKER_FONT_PERCENT,
  POINT_MARKER_RADIUS_PERCENT,
  POINT_MARKER_WIDTH_PERCENT,
} from "@store/shared/constants/numberedShawl";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import {
  NUMBERED_PHOTO_MAX_HEIGHT,
  NUMBERED_PHOTO_PLACEHOLDER_RATIO,
  NUMBERED_PHOTO_SIZES,
  NUMBER_MARKER_MAX_BORDER_PX,
  NUMBER_MARKER_MAX_FONT_PX,
  NUMBER_MARKER_MAX_WIDTH_PX,
  NUMBER_MARKER_MIN_BORDER_PX,
  NUMBER_MARKER_MIN_FONT_PX,
  NUMBER_MARKER_MIN_WIDTH_PX,
  NUMBER_MARKER_TOUCH_PADDING_PX,
} from "@/constants/numbered";
import { hasImageFailed, markImageFailed, resolveImageUrl } from "@/lib/image-fallback";
import { numberVariantTypeId, variantNumber } from "@/lib/numbered";
import { primaryImage } from "@/lib/primary-image";

interface NumberedPhotoProps {
  product: Product;
  chosenIds: ReadonlySet<string>;
  onToggle: (variant: Variant) => void;
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Numbers drawn where the admin placed them (percentages of the photo's natural-ratio box), each one a button that chooses that shawl; renders nothing until a number is placed.
export function NumberedPhoto({ product, chosenIds, onToggle }: NumberedPhotoProps) {
  const t = useTranslations("sell.picker");
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  const image = primaryImage(product.images);
  const src = image ? resolveImageUrl(image.url) : null;
  const [failed, setFailed] = useState(() => (src ? hasImageFailed(src) : false));

  useEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        setBoxWidth(width);
      }
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const numberTypeId = numberVariantTypeId(product);
  const placed = numberTypeId
    ? product.variants.flatMap((variant) => {
        const number = variantNumber(variant, numberTypeId);
        return number !== null && variant.imageX != null && variant.imageY != null
          ? [{ variant, number, x: variant.imageX, y: variant.imageY }]
          : [];
      })
    : [];

  if (!image || !src || failed || placed.length === 0) {
    return null;
  }

  const colors = resolvePointColors(product, image.brightness);
  const markerWidth = clamp(
    NUMBER_MARKER_MIN_WIDTH_PX,
    (boxWidth * POINT_MARKER_WIDTH_PERCENT) / 100,
    NUMBER_MARKER_MAX_WIDTH_PX,
  );
  const markerHeight = markerWidth / POINT_MARKER_ASPECT_RATIO;
  const borderWidth = clamp(
    NUMBER_MARKER_MIN_BORDER_PX,
    (boxWidth * POINT_MARKER_BORDER_PERCENT) / 100,
    NUMBER_MARKER_MAX_BORDER_PX,
  );
  const markerStyle: CSSProperties = {
    width: `${markerWidth}px`,
    height: `${markerHeight}px`,
    borderRadius: `${(markerHeight * POINT_MARKER_RADIUS_PERCENT) / 100}px`,
    fontSize: `${clamp(NUMBER_MARKER_MIN_FONT_PX, (boxWidth * POINT_MARKER_FONT_PERCENT) / 100, NUMBER_MARKER_MAX_FONT_PX)}px`,
    borderWidth: `${borderWidth}px`,
    color: colors.text,
    backgroundColor: colors.background,
    borderColor: colors.text,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.45)",
  };
  const boxRatio = ratio ?? NUMBERED_PHOTO_PLACEHOLDER_RATIO;

  return (
    <div className="flex justify-center" data-test-selector="pos-numbered-photo">
      <div
        ref={boxRef}
        // The photo's own ratio, capped by height and width, so the percentages land where they were placed.
        style={{ aspectRatio: boxRatio, width: `min(100%, calc(${boxRatio} * ${NUMBERED_PHOTO_MAX_HEIGHT}))` }}
        className="relative overflow-hidden rounded-photo bg-sunken"
        // The numbers are part of the picture: they must not flip in RTL.
        dir="ltr"
      >
        <Image
          src={src}
          alt={t("numberedPhotoAlt")}
          fill
          sizes={NUMBERED_PHOTO_SIZES}
          className="object-contain"
          draggable={false}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setRatio(img.naturalWidth / img.naturalHeight);
            }
          }}
          onError={() => {
            markImageFailed(src);
            setFailed(true);
          }}
        />
        {ratio !== null &&
          placed.map(({ variant, number, x, y }) => {
            const soldOut = variant.stock <= 0;
            const chosen = chosenIds.has(variant.id);
            return (
              <button
                key={variant.id}
                type="button"
                disabled={soldOut}
                aria-pressed={chosen}
                aria-label={t("numberedPoint", { number })}
                onClick={() => onToggle(variant)}
                data-test-selector={testSelectorFor("pos-shawl-point", number)}
                style={{
                  ...markerStyle,
                  left: `${x}%`,
                  top: `${y}%`,
                  // An outline, so the badge's own edge keeps the shop's colour.
                  outline: chosen ? `${borderWidth + 2}px solid var(--color-primary-600)` : undefined,
                  outlineOffset: `${borderWidth}px`,
                }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-solid font-bold leading-none tabular-nums focus-darken disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through"
              >
                <span
                  aria-hidden="true"
                  className="absolute"
                  style={{ inset: `-${NUMBER_MARKER_TOUCH_PADDING_PX}px` }}
                />
                {number}
              </button>
            );
          })}
      </div>
    </div>
  );
}
