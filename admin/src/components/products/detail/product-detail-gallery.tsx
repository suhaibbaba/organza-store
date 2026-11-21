"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2 } from "lucide-react";
import { Badge, CardButton, ImageViewer, Typography } from "@store/ui";
import { PRODUCT_DETAIL_IMAGE_SIZES, PRODUCT_DETAIL_THUMB_SIZES } from "@/constants/images";
import { resolveImageUrl } from "@/lib/image-fallback";
import { ProductImage } from "@/components/products/product-image";
import type { GalleryPhoto, ProductDetailGalleryProps } from "@/types/product";

export function ProductDetailGallery({ photos, name }: ProductDetailGalleryProps) {
  const t = useTranslations("products.detail.gallery");
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const active = photos[index] ?? null;

  const caption = (photo: GalleryPhoto) =>
    photo.kind === "numbered" ? t("numbered") : photo.kind === "variant" ? t("variant", { name: photo.variantName ?? "" }) : null;

  if (!active) {
    return (
      <div data-test-selector="product-gallery" className="flex flex-col gap-2">
        <div className="aspect-square w-full overflow-hidden rounded-card border border-line bg-sunken">
          <ProductImage src={null} alt={name} fit="contain" className="size-full" sizes={PRODUCT_DETAIL_IMAGE_SIZES} />
        </div>
        <Typography variant="caption" tone="muted" className="text-center">{t("none")}</Typography>
      </div>
    );
  }

  const activeCaption = caption(active);

  return (
    <div data-test-selector="product-gallery" className="flex flex-col gap-3">
      <CardButton
        data-testid="product-photo-main"
        aria-label={t("open")}
        onClick={() => setViewerOpen(true)}
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-card bg-sunken"
      >
        <ProductImage src={active.url} alt={name} fit="contain" className="size-full" sizes={PRODUCT_DETAIL_IMAGE_SIZES} eager />
        <span className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-pill bg-surface/90 text-primary-700 shadow-card transition-colors group-hover:bg-surface group-focus-visible:bg-primary-50">
          <Maximize2 className="size-4" aria-hidden="true" />
        </span>
        {activeCaption && (
          <span className="absolute bottom-3 start-3">
            <Badge tone={active.kind === "numbered" ? "info" : "neutral"}>{activeCaption}</Badge>
          </span>
        )}
      </CardButton>

      {photos.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" data-test-selector="product-photo-thumbnails">
          {photos.map((photo, position) => (
            <li key={photo.id}>
              <CardButton
                data-testid={`product-photo-thumbnail-${position + 1}`}
                selected={position === index}
                aria-label={t("show", { number: position + 1 })}
                onClick={() => setIndex(position)}
                className="aspect-square overflow-hidden rounded-control bg-sunken p-0.5"
              >
                <ProductImage src={photo.thumbnailUrl} alt="" fit="contain" className="size-full rounded-chip" sizes={PRODUCT_DETAIL_THUMB_SIZES} />
              </CardButton>
            </li>
          ))}
        </ul>
      )}

      <ImageViewer
        data-testid="product-photo-viewer"
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        index={index}
        onIndexChange={setIndex}
        images={photos.map((photo) => ({
          id: photo.id,
          src: resolveImageUrl(photo.url),
          thumbnailSrc: resolveImageUrl(photo.thumbnailUrl),
          alt: caption(photo) ?? name,
        }))}
      />
    </div>
  );
}
