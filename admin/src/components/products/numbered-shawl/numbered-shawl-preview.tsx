"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { resolvePointColors } from "@organza/shared/lib/pointColors";
import type { Product } from "@organza/shared/types/product";
import { initShawlPoints } from "@/lib/validation/numbered-shawl";
import { ImagePointCanvas } from "@/components/products/numbered-shawl/image-point-canvas";

// The product screen's read-only twin of the placement tool: a numbered
// shawl is its numbers, so the detail page has to show the photo with them
// on it, not a bare photo. It renders through the very same canvas the
// points were placed with — each point is a percentage of that box, and only
// that box (natural aspect ratio, object-contain, no cropping), so the
// numbers land where they were put at any screen size.
export function NumberedShawlPreview({ product }: { product: Product }) {
  const t = useTranslations("products.detail");

  const points = useMemo(() => initShawlPoints(product.variants), [product.variants]);
  // Placed against the primary photo (the same one the editor opens), so a
  // later gallery reorder can't move the numbers onto a different picture.
  const image = product.images.find((img) => img.isPrimary) ?? product.images[0] ?? null;

  if (!image || points.length === 0) return null;

  // The shop's own choice where it made one, and a suggestion read from this
  // photo's brightness where it did not — the same call the editor and (once
  // built) the WhatsApp copy make, so what the customer is sent looks like
  // what the shop is looking at.
  const colors = resolvePointColors(product, image.brightness);

  return (
    <div className="flex w-full max-w-sm flex-col gap-2" data-test-selector="numbered-shawl-preview">
      <ImagePointCanvas readOnly imageUrl={image.url} alt={t("numberedPointsAlt")} points={points} colors={colors} />
      <p className="text-sm text-muted-foreground">{t("numberedPointsHint", { count: points.length })}</p>
    </div>
  );
}

// Whether the detail page should show the preview above instead of the plain
// gallery: the product has to BE a numbered one (its own flag, never guessed
// from its variants), and its numbers have to have been placed on the photo.
export function hasPlacedShawlPoints(product: Product): boolean {
  return (
    product.isNumbered &&
    product.images.length > 0 &&
    product.variants.some((v) => v.imageX != null && v.imageY != null)
  );
}
