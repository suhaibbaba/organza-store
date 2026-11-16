"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { Crop, GripVertical, Star, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/products/product-image";
import { Spinner } from "@/components/ui/spinner";
import { IMAGE_GRID_THUMB_SIZES } from "@/constants/images";
import { cn } from "@/lib/utils";

interface SortableImageThumbProps {
  id: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  isBusy: boolean;
  canDelete: boolean;
  // Drawn from a local blob: URL — a staged pick, or a photo whose new
  // framing has been previewed here but not saved yet. next/image cannot
  // resolve either against the API origin, so it renders as a plain
  // background instead.
  isNew?: boolean;
  // Whether this photograph can be framed at all: a picked file always can, a
  // stored one only if the API kept its original.
  canEdit?: boolean;
  // Carrying a re-framing that has not been saved yet.
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
        // 2:3, the shape a product photo is framed to (shared's
        // PRODUCT_IMAGE_ASPECT). A square tile would show every crop
        // letterboxed and make the one thing this gallery is now for — did
        // this photograph come out the right shape? — the one thing it could
        // not answer.
        "relative aspect-[2/3] touch-none overflow-hidden rounded-xl border border-border bg-muted",
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
        className="absolute start-1 top-1 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onTogglePrimary(id)}
        disabled={isBusy}
        aria-pressed={isPrimary}
        aria-label={t("setPrimary")}
        className="absolute end-1 top-1 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Star className={cn("size-4", isPrimary && "fill-amber-400 text-amber-400")} aria-hidden="true" />
      </button>

      {/* The bottom of the tile, as TWO rows rather than one.
          
          The controls share the upper row, at opposite ends, where a 36px hit
          area each fits comfortably. The word "رئيسية" gets a row of its own,
          the full width of the tile — because it did not fit beside them: a
          tile is about a third of a phone's width, and once the photo shape
          became 2:3 the label was left with forty pixels and was reported
          from the shop floor as "مقصوصة". A label that has to be guessed at
          is worse than no label, and truncating it was the bug. */}
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
                "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-white/20 disabled:cursor-not-allowed disabled:opacity-50",
                // A photo carrying an unsaved re-framing says so on the tile
                // itself: the gallery is the only place that difference is
                // visible until the form is saved.
                isEdited ? "bg-primary" : "bg-black/60"
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
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white shadow-sm ring-1 ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {isPrimary && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-center text-xs font-medium text-primary-foreground">
            {t("primaryBadge")}
          </span>
        )}
      </div>

      {isBusy && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
          <Spinner className="size-5 text-white" />
        </div>
      )}
    </div>
  );
}
