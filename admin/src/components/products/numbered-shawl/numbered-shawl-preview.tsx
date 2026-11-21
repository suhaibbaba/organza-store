"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { resolvePointColors } from "@organza/shared/lib/pointColors";
import type { Product } from "@organza/shared/types/product";
import { initShawlPoints, placedShawlPoints } from "@/lib/validation/numbered-shawl";
import { ImagePointCanvas } from "@/components/products/numbered-shawl/image-point-canvas";

// Read-only twin of the placement tool, through the same canvas, so points (percentages of it) land where they were put.
export function NumberedShawlPreview({ product }: { product: Product }) {
  const t = useTranslations("products.detail");

  const points = useMemo(() => placedShawlPoints(initShawlPoints(product.variants)), [product.variants]);
  // The primary photo, so a gallery reorder can't move the numbers onto another picture.
  const image = product.images.find((img) => img.isPrimary) ?? product.images[0] ?? null;

  if (!image || points.length === 0) return null;

  // The shop's colours, else the photo's suggestion — the same call the editor makes.
  const colors = resolvePointColors(product, image.brightness);

  return (
    <div className="flex w-full max-w-sm flex-col gap-2" data-test-selector="numbered-shawl-preview">
      <ImagePointCanvas readOnly imageUrl={image.url} alt={t("numberedPointsAlt")} points={points} colors={colors} />
      <p className="text-label text-ink-muted">{t("numberedPointsHint", { count: points.length })}</p>
    </div>
  );
}

// Numbered by its own flag (never guessed from variants), with points placed.
export function hasPlacedShawlPoints(product: Product): boolean {
  return (
    product.isNumbered &&
    product.images.length > 0 &&
    product.variants.some((v) => v.imageX != null && v.imageY != null)
  );
}
