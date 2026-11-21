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
  isNew?: boolean;
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

  const tool =
    "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-inverse transition-colors hover:bg-ink-inverse/20 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-test-selector={`image-thumb-${id}`}
      className={cn(
        "group relative aspect-square touch-none overflow-hidden rounded-control border bg-inset",
        isPrimary ? "border-primary-600 ring-2 ring-primary-600/25" : "border-line",
        isDragging && "z-10 opacity-60 shadow-float"
      )}
    >
      {isNew ? (
        <div className="size-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
      ) : (
        <ProductImage src={thumbnailUrl} alt="" fit="contain" className="size-full" sizes={IMAGE_GRID_THUMB_SIZES} />
      )}

      {isPrimary && (
        <span className="absolute start-1.5 top-1.5 z-10 rounded-pill bg-primary-600 px-2 py-0.5 text-micro text-ink-inverse">
          {t("primaryBadge")}
        </span>
      )}
      {isEdited && (
        <span aria-hidden="true" className="absolute end-1.5 top-1.5 z-10 size-2.5 rounded-pill bg-primary-600 ring-2 ring-surface" />
      )}

      <div className="absolute inset-x-1.5 bottom-1.5 z-10 flex items-center justify-between gap-0.5 rounded-pill bg-ink/65 p-0.5 backdrop-blur-sm">
        <button type="button" {...attributes} {...listeners} aria-label={t("dragHandle")} className={cn(tool, "cursor-grab")}>
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onTogglePrimary(id)}
          disabled={isBusy}
          aria-pressed={isPrimary}
          aria-label={t("setPrimary")}
          className={tool}
        >
          <Star className={cn("size-3.5", isPrimary && "fill-warning-500 text-warning-500")} aria-hidden="true" />
        </button>
        {canEdit && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(id)}
            disabled={isBusy}
            aria-label={t("edit")}
            data-test-selector={`image-edit-${id}`}
            className={tool}
          >
            <Crop className="size-3.5" aria-hidden="true" />
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => onRemove(id)} disabled={isBusy} aria-label={t("delete")} className={tool}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
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
