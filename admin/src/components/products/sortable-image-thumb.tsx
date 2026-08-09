"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { GripVertical, Star, Trash2 } from "lucide-react";
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
  // A staged, not-yet-uploaded pick: its preview is a local blob: URL, which
  // next/image can't resolve against the API origin, so it renders as a plain
  // background instead.
  isNew?: boolean;
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
        "relative aspect-square touch-none overflow-hidden rounded-xl border border-border bg-muted",
        isDragging && "z-10 opacity-60"
      )}
    >
      {isNew ? (
        <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
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

      {/* Bottom bar: the "primary" badge and the remove control share one flex
          row (badge at the start, remove at the end) so they can never overlap
          however narrow the thumbnail gets on a phone — the badge truncates
          while the remove button keeps its full 36px hit area (shrink-0) and
          sits above everything via z-index. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-1">
        {isPrimary ? (
          <span className="min-w-0 truncate rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            {t("primaryBadge")}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            disabled={isBusy}
            aria-label={t("delete")}
            className="z-20 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white shadow-sm ring-1 ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
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
