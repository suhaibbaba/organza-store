"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { Crop, GripVertical, Star, Trash2 } from "lucide-react";
import { Spinner } from "@store/ui";
import { ProductImage } from "@/components/products/product-image";
import { IMAGE_GRID_THUMB_SIZES } from "@/constants/images";
import { cn } from "@/lib/utils";

interface SortableImageThumbProps {
  id: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  isBusy: boolean;
  canDelete: boolean;
  // A local blob: URL (staged pick or unsaved re-framing), which next/image can't resolve, so it's a plain background.
  isNew?: boolean;
  // A stored photo can be re-framed only if the API kept its original.
  canEdit?: boolean;
  isEdited?: boolean;
  onEdit?: (id: string) => void;
  onTogglePrimary: (id: string) => void;
  onRemove: (id: string) => void;
}

export function SortableImageThumb({
  id,
  thumbnailUrl,
  isPrimary,
  isBusy,
  canDelete,
  isNew = false,
  canEdit = false,
  isEdited = false,
  onEdit,
  onTogglePrimary,
  onRemove,
}: SortableImageThumbProps) {
  const t = useTranslations("products.form.images");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // 2:3, the framing shape (PRODUCT_IMAGE_ASPECT), so the tile shows whether the crop came out right.
        "relative aspect-[2/3] touch-none overflow-hidden rounded-card border border-line bg-inset",
        isDragging && "z-10 opacity-60"
      )}
    >
      {isNew ? (
        <div className="size-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
      ) : (
        <ProductImage src={thumbnailUrl} alt="" className="size-full" sizes={IMAGE_GRID_THUMB_SIZES} />
      )}

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("dragHandle")}
        className="absolute start-1 top-1 z-10 inline-flex size-8 items-center justify-center rounded-pill bg-ink/50 text-ink-inverse"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onTogglePrimary(id)}
        disabled={isBusy}
        aria-pressed={isPrimary}
        aria-label={t("setPrimary")}
        className="absolute end-1 top-1 z-10 inline-flex size-8 items-center justify-center rounded-pill bg-ink/50 text-ink-inverse disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Star className={cn("size-4", isPrimary && "fill-warning-500 text-warning-500")} aria-hidden="true" />
      </button>

      {/* The primary label gets its own row: beside the controls it was truncated on phones. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-1">
        <div className="flex items-end justify-between gap-1">
          {canEdit && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(id)}
              disabled={isBusy}
              aria-label={t("edit")}
              data-test-selector={`image-edit-${id}`}
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-inverse shadow-pill ring-1 ring-ink-inverse/20 disabled:cursor-not-allowed disabled:opacity-50",
                isEdited ? "bg-primary-600" : "bg-ink/60"
              )}
            >
              <Crop className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onRemove(id)}
              disabled={isBusy}
              aria-label={t("delete")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-ink/60 text-ink-inverse shadow-pill ring-1 ring-ink-inverse/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {isPrimary && (
          <span className="rounded-pill bg-primary-600 px-2 py-0.5 text-center text-micro font-medium text-ink-inverse">
            {t("primaryBadge")}
          </span>
        )}
      </div>

      {isBusy && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30">
          <Spinner className="size-5 text-ink-inverse" />
        </div>
      )}
    </div>
  );
}
