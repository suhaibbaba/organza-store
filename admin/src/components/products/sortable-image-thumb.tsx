"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { GripVertical, Star, Trash2 } from "lucide-react";
import type { ProductImageRef } from "@shared/types/variant";
import { ProductImage } from "@/components/products/product-image";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_GRID_THUMB_SIZES } from "@/constants/images";
import { cn } from "@/lib/utils";

interface SortableImageThumbProps {
  image: ProductImageRef;
  isBusy: boolean;
  canDelete: boolean;
  isConfirmingDelete: boolean;
  onTogglePrimary: (imageId: string, next: boolean) => void;
  onRequestDelete: (imageId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (imageId: string) => void;
}

export function SortableImageThumb({
  image,
  isBusy,
  canDelete,
  isConfirmingDelete,
  onTogglePrimary,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SortableImageThumbProps) {
  const t = useTranslations("products.form.images");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative aspect-square touch-none overflow-hidden rounded-xl border border-border bg-muted",
        isDragging && "z-10 opacity-60"
      )}
    >
      <ProductImage src={image.thumbnailUrl} alt="" className="size-full" sizes={IMAGE_GRID_THUMB_SIZES} />

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("dragHandle")}
        className="absolute start-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onTogglePrimary(image.id, !image.isPrimary)}
        disabled={isBusy}
        aria-pressed={image.isPrimary}
        aria-label={image.isPrimary ? t("clearPrimary") : t("setPrimary")}
        className="absolute end-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-50"
      >
        <Star className={cn("size-4", image.isPrimary && "fill-amber-400 text-amber-400")} aria-hidden="true" />
      </button>

      {canDelete &&
        (isConfirmingDelete ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/70 py-1.5">
            <button type="button" onClick={() => onConfirmDelete(image.id)} className="text-xs font-semibold text-white">
              {t("confirmDelete")}
            </button>
            <button type="button" onClick={onCancelDelete} className="text-xs text-white/80">
              {t("cancelDelete")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDelete(image.id)}
            disabled={isBusy}
            aria-label={t("delete")}
            className="absolute bottom-1 end-1 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        ))}

      {image.isPrimary && (
        <span className="absolute bottom-1 start-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
          {t("primaryBadge")}
        </span>
      )}

      {isBusy && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Spinner className="size-5 text-white" />
        </div>
      )}
    </div>
  );
}
