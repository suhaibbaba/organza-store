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
import type { ImageEdit } from "@organza/shared/lib/imageEdit";
import { useTranslateError } from "@/hooks/use-translate-error";
import { appendFiles, applyEditToSlot, moveSlot, removeSlot, setPrimarySlot } from "@/lib/image-slots";
import { editOrIdentity, editToSend, renderCropPreview } from "@/lib/image-edit";
import { resolveImageUrl } from "@/lib/image-fallback";
import { ImageEditorSheet } from "@/components/products/image-editor-sheet";
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

/** What the editor is currently working on, and what it moves to next. */
interface EditTarget {
  id: string;
  src: string;
  edit: ImageEdit;
  // A photo already on the API host, which the preview canvas has to ask for
  // with CORS or it comes back tainted and refuses to draw.
  crossOrigin: boolean;
}

// Picks, removes, reorders, frames and chooses the main photo — all in local
// form state, nothing sent anywhere. There is no Save here on purpose: photos
// are part of the product, so they are written by the product form's one Save
// button along with everything else (and on a brand-new product they are
// uploaded straight after it is created, with no second trip through edit).
export function ImageManager({ slots, onChange, canDelete, isBusy = false, emptyHint }: ImageManagerProps) {
  const t = useTranslations("products.form.images");
  const translateError = useTranslateError();
  const inputRef = useRef<HTMLInputElement>(null);
  // Only ever a rejected pick (wrong type, too big) — caught locally before
  // anything is queued. Save failures are reported by the form.
  const [rejected, setRejected] = useState<string | null>(null);
  // The photographs still to be framed, oldest first, and where we are in
  // them. Picking three at once opens the editor three times in a row without
  // ever going back to the form — which is the whole difference between
  // "edit your photos" and "edit a photo, find the form, edit the next one".
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  // Resolved from the CURRENT slots rather than captured when the queue was
  // built, so the editor always opens on the photo as it stands now — a
  // second pass shows the crop the first one left.
  const target = editTargetFor(slots, queue[queueIndex]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const { slots: next, rejectedCode } = appendFiles(slots, Array.from(fileList));
    setRejected(rejectedCode ? translateError(rejectedCode) : null);
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";

    // Straight into the editor for everything just picked. Not a prompt
    // asking whether to edit: the shop is standing at a counter, and the
    // answer to "would you like to frame this photograph?" is always yes.
    const added = next.filter((slot) => !slots.some((existing) => existing.id === slot.id));
    if (added.length > 0) {
      setQueue(added.map((slot) => slot.id));
      setQueueIndex(0);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
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
    if (!target) return;
    // A look round the editor that changed nothing is not an edit: it must
    // not become a stored crop, nor a re-cut of a photograph on the server.
    const kept = editToSend(edit);
    // Drawn locally, and ONLY as a preview — the picture that is stored is cut
    // by sharp from the original (lib/image-edit.ts says why at length). A
    // browser that will not draw one is not an error: the tile keeps the
    // picture it has and the crop is saved exactly as framed.
    const preview = kept ? await renderCropPreview(target.src, kept, { crossOrigin: target.crossOrigin }) : null;
    onChange(applyEditToSlot(slots, target.id, kept, preview));
    closeOrAdvance();
  }

  return (
    <div className="flex flex-col gap-3" data-test-selector="image-manager">
      <label
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors active:bg-primary/10",
          isBusy && "pointer-events-none opacity-50"
        )}
      >
        <ImagePlus className="size-5" aria-hidden="true" />
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

      {rejected && (
        <p className="text-sm text-destructive" data-test-selector="image-upload-error">
          {rejected}
        </p>
      )}

      {slots.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2" data-test-selector="image-gallery">
              {slots.map((slot) => (
                <SortableImageThumb
                  key={slot.id}
                  id={slot.id}
                  thumbnailUrl={thumbnailFor(slot)}
                  isPrimary={slot.isPrimary}
                  isBusy={isBusy}
                  // A pick that hasn't been uploaded can always be taken back
                  // out — nothing on the server is being deleted.
                  canDelete={slot.kind === "new" || canDelete}
                  isNew={slot.kind === "new" || Boolean(slot.previewUrl)}
                  // Framing needs a whole photograph to cut from: the picked
                  // file, or the original kept at upload. A photo stored
                  // before originals were kept has neither, so it is not
                  // offered something that would fail.
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

      {target && (
        <ImageEditorSheet
          // Keyed by photo: moving to the next one in a batch is a fresh
          // editor, not the same one handed a different picture, so no zoom
          // or crop can survive from the last.
          key={target.id}
          src={target.src}
          crossOrigin={target.crossOrigin}
          edit={target.edit}
          step={{ index: queueIndex + 1, total: queue.length }}
          // Leaves this photograph exactly as it is — kept whole if it was
          // never framed — and moves on to the next in the batch.
          onCancel={closeOrAdvance}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
}

/** The picture a tile shows: a local preview if there is one, else the stored thumbnail. */
function thumbnailFor(slot: GallerySlot): string {
  if (slot.kind === "new") return slot.previewUrl;
  return slot.previewUrl ?? slot.image.thumbnailUrl;
}

/**
 * Can this photo be framed, and from what?
 *
 * A picked file always can — the browser is holding it. A stored one can only
 * if the API kept its original, which it has done since the editor existed;
 * anything older is left alone rather than offered a button that would answer
 * "there is nothing to cut from".
 */
function editTargetFor(slots: GallerySlot[], id: string | undefined): EditTarget | null {
  if (!id) return null;
  const slot = slots.find((candidate) => candidate.id === id);
  if (!slot) return null;
  if (slot.kind === "new") {
    return { id: slot.id, src: slot.sourceUrl, edit: editOrIdentity(slot.edit), crossOrigin: false };
  }
  const original = slot.image.originalUrl;
  if (!original) return null;
  return {
    id: slot.id,
    // Stored paths are API-relative; the admin is on its own origin.
    src: resolveImageUrl(original),
    // Whatever crop it is carrying — a pending one first, then whatever the
    // server has recorded, so re-opening never starts from scratch.
    edit: editOrIdentity(slot.edit ?? slot.image.edit),
    crossOrigin: true,
  };
}
