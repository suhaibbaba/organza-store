"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus } from "lucide-react";
import { useTranslateError } from "@/hooks/use-translate-error";
import { appendFiles, moveSlot, removeSlot, setPrimarySlot } from "@/lib/image-slots";
import { SortableImageThumb } from "@/components/products/sortable-image-thumb";
import { cn } from "@/lib/utils";
import type { GallerySlot } from "@/types/productForm";

interface ImageManagerProps {
  slots: GallerySlot[];
  onChange: (slots: GallerySlot[]) => void;
  canDelete: boolean;
  // The form is saving — the whole gallery goes quiet rather than offering
  // controls that would race the upload it is doing.
  isBusy?: boolean;
  emptyHint?: string;
}

// Picks, removes, reorders and chooses the main photo — all in local form
// state, nothing sent anywhere. There is no Save here on purpose: photos are
// part of the product, so they are written by the product form's one Save
// button along with everything else (and on a brand-new product they are
// uploaded straight after it is created, with no second trip through edit).
export function ImageManager({ slots, onChange, canDelete, isBusy = false, emptyHint }: ImageManagerProps) {
  const t = useTranslations("products.form.images");
  const translateError = useTranslateError();
  const inputRef = useRef<HTMLInputElement>(null);
  // Only ever a rejected pick (wrong type, too big) — caught locally before
  // anything is queued. Save failures are reported by the form.
  const [rejected, setRejected] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const { slots: next, rejectedCode } = appendFiles(slots, Array.from(fileList));
    setRejected(rejectedCode ? translateError(rejectedCode) : null);
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(moveSlot(slots, String(active.id), String(over.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors active:bg-primary/10",
          isBusy && "pointer-events-none opacity-50"
        )}
      >
        <ImagePlus className="size-5" aria-hidden="true" />
        {t("addImages")}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={isBusy}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {rejected && <p className="text-sm text-destructive">{rejected}</p>}

      {slots.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <SortableImageThumb
                  key={slot.id}
                  id={slot.id}
                  thumbnailUrl={slot.kind === "existing" ? slot.image.thumbnailUrl : slot.previewUrl}
                  isPrimary={slot.isPrimary}
                  isBusy={isBusy}
                  // A pick that hasn't been uploaded can always be taken back
                  // out — nothing on the server is being deleted.
                  canDelete={slot.kind === "new" || canDelete}
                  isNew={slot.kind === "new"}
                  onTogglePrimary={(id) => onChange(setPrimarySlot(slots, id))}
                  onRemove={(id) => onChange(removeSlot(slots, id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {slots.length === 0 && emptyHint && <p className="text-sm text-muted-foreground">{emptyHint}</p>}

      {/* Photos picked but not sent yet: says plainly that the one Save at the
          bottom is what will upload them. */}
      {slots.some((s) => s.kind === "new") && !isBusy && (
        <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>
      )}
    </div>
  );
}
