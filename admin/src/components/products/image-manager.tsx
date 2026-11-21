"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus } from "lucide-react";
import type { ImageEdit } from "@store/shared/lib/imageEdit";
import { useTranslateError } from "@/hooks/use-translate-error";
import { appendFiles, applyEditToSlot, moveSlot, removeSlot, setPrimarySlot } from "@/lib/image-slots";
import { editOrIdentity, editToSend, renderCropPreview } from "@/lib/image-edit";
import { optimizedImageUrl, resolveImageUrl } from "@/lib/image-fallback";
import { EDITOR_SOURCE_WIDTH } from "@/constants/images";
import { ImageEditorSheet } from "@/components/products/image-editor-sheet";
import { SortableImageThumb } from "@/components/products/sortable-image-thumb";
import { cn } from "@/lib/utils";
import type { GallerySlot } from "@/types/productForm";

interface ImageManagerProps {
  slots: GallerySlot[];
  onChange: (slots: GallerySlot[]) => void;
  canDelete: boolean;
  isBusy?: boolean;
  emptyHint?: string;
}

/** What the editor is currently working on, and what it moves to next. */
interface EditTarget {
  id: string;
  src: string;
  edit: ImageEdit;
  crossOrigin: boolean;
  fallbackSrc?: string;
}

export function ImageManager({ slots, onChange, canDelete, isBusy = false, emptyHint }: ImageManagerProps) {
  const t = useTranslations("products.form.images");
  const translateError = useTranslateError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  const target = editTargetFor(slots, queue[queueIndex]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const { slots: next, rejectedCode } = appendFiles(slots, Array.from(fileList));
    setRejected(rejectedCode ? translateError(rejectedCode) : null);
    onChange(next);
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    const added = next.filter((slot) => !slots.some((existing) => existing.id === slot.id));
    if (added.length > 0) {
      setQueue(added.map((slot) => slot.id));
      setQueueIndex(0);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    onChange(moveSlot(slots, String(active.id), String(over.id)));
  }

  function closeOrAdvance() {
    if (queueIndex + 1 < queue.length) {
      setQueueIndex(queueIndex + 1);
      return;
    }
    setQueue([]);
    setQueueIndex(0);
  }

  async function handleEditorSave(edit: ImageEdit) {
    if (!target) {
      return;
    }
    const kept = editToSend(edit);
    const preview = kept ? await renderCropPreview(target.src, kept, { crossOrigin: target.crossOrigin }) : null;
    onChange(applyEditToSlot(slots, target.id, kept, preview));
    closeOrAdvance();
  }

  return (
    <div className="flex flex-col gap-3" data-test-selector="image-manager">
      {rejected && (
        <p className="text-label text-danger-600" data-test-selector="image-upload-error">
          {rejected}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]"
            data-test-selector="image-gallery"
          >
            {slots.map((slot) => (
              <SortableImageThumb
                key={slot.id}
                id={slot.id}
                thumbnailUrl={thumbnailFor(slot)}
                isPrimary={slot.isPrimary}
                isBusy={isBusy}
                canDelete={slot.kind === "new" || canDelete}
                isNew={slot.kind === "new" || Boolean(slot.previewUrl)}
                canEdit={Boolean(editTargetFor(slots, slot.id))}
                isEdited={Boolean(slot.edit)}
                onEdit={(id) => {
                  setQueue([id]);
                  setQueueIndex(0);
                }}
                onTogglePrimary={(id) => onChange(setPrimarySlot(slots, id))}
                onRemove={(id) => onChange(removeSlot(slots, id))}
              />
            ))}
            <label
              data-test-selector="image-add-tile"
              className={cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-primary-300 bg-primary-50 px-2 text-center text-label text-primary-600 transition-colors hover:border-primary-600 hover:bg-primary-100 has-focus-visible:border-primary-700 has-focus-visible:bg-primary-200",
                isBusy && "pointer-events-none opacity-50",
              )}
            >
              <ImagePlus className="size-6" aria-hidden="true" />
              {t("addImages")}
              <input
                data-test-selector="image-upload-input"
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={isBusy}
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
        </SortableContext>
      </DndContext>

      {slots.length === 0 && emptyHint && <p className="text-label text-ink-muted">{emptyHint}</p>}

      {slots.some((s) => s.kind === "new") && !isBusy && (
        <p className="text-label text-ink-muted">{t("pendingHint")}</p>
      )}

      {target && (
        <ImageEditorSheet
          key={target.id}
          src={target.src}
          crossOrigin={target.crossOrigin}
          fallbackSrc={target.fallbackSrc}
          edit={target.edit}
          step={{ index: queueIndex + 1, total: queue.length }}
          onCancel={closeOrAdvance}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
}

/** The picture a tile shows: a local preview if there is one, else the stored thumbnail. */
function thumbnailFor(slot: GallerySlot): string {
  if (slot.kind === "new") {
    return slot.previewUrl;
  }
  return slot.previewUrl ?? slot.image.thumbnailUrl;
}

/** Every photo can be re-framed: pre-editor photos use their largest stored size, which the server then promotes to original. */
function editTargetFor(slots: GallerySlot[], id: string | undefined): EditTarget | null {
  if (!id) {
    return null;
  }
  const slot = slots.find((candidate) => candidate.id === id);
  if (!slot) {
    return null;
  }
  if (slot.kind === "new") {
    return { id: slot.id, src: slot.sourceUrl, edit: editOrIdentity(slot.edit), crossOrigin: false };
  }
  const source = slot.image.originalUrl ?? slot.image.url;
  if (!source) {
    return null;
  }
  const original = resolveImageUrl(source);
  return {
    id: slot.id,
    src: optimizedImageUrl(original, EDITOR_SOURCE_WIDTH),
    edit: editOrIdentity(slot.edit ?? slot.image.edit),
    crossOrigin: false,
    fallbackSrc: original,
  };
}
