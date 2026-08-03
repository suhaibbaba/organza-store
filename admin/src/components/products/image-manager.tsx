"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus } from "lucide-react";
import type { ProductImageRef } from "@shared/types/variant";
import { useTranslateError } from "@/hooks/use-translate-error";
import { validateImageFile } from "@/lib/validation/image";
import { uploadImage, reorderImages, setPrimaryImage, deleteImage, type ImageOwner } from "@/lib/api/images";
import { SortableImageThumb } from "@/components/products/sortable-image-thumb";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { cn } from "@/lib/utils";

// A slot in the working gallery: either an already-saved server image, or a
// brand-new file the user just picked that hasn't been uploaded yet. Both
// carry a stable `id` (the server id, or a temp id) so dnd-kit can track them
// and so the primary flag can point at one regardless of kind.
type GallerySlot =
  | { kind: "existing"; id: string; image: ProductImageRef; isPrimary: boolean }
  | { kind: "new"; id: string; file: File; previewUrl: string; isPrimary: boolean };

interface ImageManagerProps {
  owner: ImageOwner;
  initialImages: ProductImageRef[];
  canDelete: boolean;
  emptyHint?: string;
}

function toSlots(images: ProductImageRef[]): GallerySlot[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ kind: "existing" as const, id: image.id, image, isPrimary: image.isPrimary }));
}

// Order + membership + primary signature — the last-saved state we compare
// the working gallery against to know whether there's anything to save, and
// to detect when a fresh `initialImages` should reset the working copy.
function savedSignature(images: ProductImageRef[]): string {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => `${i.id}:${i.isPrimary ? 1 : 0}`)
    .join("|");
}

function workingSignature(slots: GallerySlot[]): string {
  return slots.map((s) => `${s.kind === "existing" ? s.id : "new"}:${s.isPrimary ? 1 : 0}`).join("|");
}

// Self-contained image editor. Unlike an autosaving gallery, every action
// (add / delete / reorder / set-primary) is staged locally and only written
// to the server on an explicit **Save** (spec.md "Persist only on an explicit
// Save — no autosave"). Leaving or hitting **Discard** without saving throws
// the staged changes away and restores the last saved state, because nothing
// touched the server yet. "Edit images" is still its own capability (works
// for Employees who can't edit product/variant details), so the Save/Discard
// controls live here rather than on the surrounding product form.
export function ImageManager({ owner, initialImages, canDelete, emptyHint }: ImageManagerProps) {
  const t = useTranslations("products.form.images");
  const translateError = useTranslateError();
  const queryClient = useQueryClient();

  const [slots, setSlots] = useState<GallerySlot[]>(() => toSlots(initialImages));
  const [savedImages, setSavedImages] = useState<ProductImageRef[]>(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the working copy when the last-saved state changes underneath us
  // (parent refetched / remounted with a new gallery). Done during render —
  // React's documented "reset state when a prop changes" pattern — so we
  // never render a stale gallery for a frame. Any unsaved staged edits are
  // intentionally dropped: server truth wins, matching "restore the last
  // saved state" on leave.
  const [syncedSig, setSyncedSig] = useState(() => savedSignature(initialImages));
  const incomingSig = savedSignature(initialImages);
  if (incomingSig !== syncedSig) {
    setSyncedSig(incomingSig);
    setSavedImages(initialImages);
    setSlots(toSlots(initialImages));
    setError(null);
    setSaved(false);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  const isDirty = workingSignature(slots) !== savedSignature(savedImages);

  function markChanged() {
    setSaved(false);
    setError(null);
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    markChanged();
    const added: GallerySlot[] = [];
    for (const file of Array.from(fileList)) {
      const invalidCode = validateImageFile(file);
      if (invalidCode) {
        setError(translateError(invalidCode));
        continue;
      }
      added.push({
        kind: "new",
        id: `new-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        isPrimary: false,
      });
    }
    setSlots((prev) => {
      const next = [...prev, ...added];
      // Keep exactly one primary: if nothing is primary yet (first images),
      // promote the first slot.
      if (next.length > 0 && !next.some((s) => s.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(id: string) {
    markChanged();
    setSlots((prev) => {
      const removed = prev.find((s) => s.id === id);
      if (removed?.kind === "new") URL.revokeObjectURL(removed.previewUrl);
      const next = prev.filter((s) => s.id !== id);
      // If we removed the primary, promote whatever is now first so there's
      // always exactly one primary while the gallery is non-empty.
      if (removed?.isPrimary && next.length > 0 && !next.some((s) => s.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  }

  function handleTogglePrimary(id: string) {
    markChanged();
    // A single tap always *sets* this slot primary (there must be exactly one
    // primary); tapping the current primary is a no-op rather than clearing it.
    setSlots((prev) => prev.map((s) => ({ ...s, isPrimary: s.id === id })));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slots.findIndex((s) => s.id === active.id);
    const newIndex = slots.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    markChanged();
    setSlots((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  function handleDiscard() {
    for (const slot of slots) if (slot.kind === "new") URL.revokeObjectURL(slot.previewUrl);
    setSlots(toSlots(savedImages));
    setError(null);
    setSaved(false);
  }

  function invalidateProducts() {
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
  }

  // Commit staged changes in an order the backend accepts: upload the new
  // files first (one at a time — the server derives each new image's
  // sortOrder from the current count, so concurrent uploads could collide),
  // delete the removed ones, then reorder the remaining set to the staged
  // order and finally fix the primary. Reorder validates that the id set
  // matches exactly, which is why deletes/uploads happen before it.
  async function handleSave() {
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const savedById = new Set(savedImages.map((i) => i.id));
      const keptExistingIds = new Set(slots.filter((s) => s.kind === "existing").map((s) => s.id));
      const deletedIds = savedImages.filter((i) => !keptExistingIds.has(i.id)).map((i) => i.id);

      // Upload new files in their staged position, resolving each to a real id.
      const resolved: { id: string; isPrimary: boolean }[] = [];
      for (const slot of slots) {
        if (slot.kind === "existing") {
          resolved.push({ id: slot.id, isPrimary: slot.isPrimary });
          continue;
        }
        const created = await uploadImage(owner, slot.file);
        URL.revokeObjectURL(slot.previewUrl);
        resolved.push({ id: created.id, isPrimary: slot.isPrimary });
      }

      for (const id of deletedIds) {
        if (savedById.has(id)) await deleteImage(id);
      }

      let finalImages: ProductImageRef[] = [];
      if (resolved.length > 0) {
        finalImages = await reorderImages(owner, resolved.map((r) => r.id));

        const primaryId = (resolved.find((r) => r.isPrimary) ?? resolved[0]).id;
        if (!finalImages.find((i) => i.id === primaryId)?.isPrimary) {
          const updatedPrimary = await setPrimaryImage(primaryId, true);
          finalImages = finalImages.map((i) =>
            i.id === primaryId ? updatedPrimary : { ...i, isPrimary: false }
          );
        }
      }

      setSavedImages(finalImages);
      setSyncedSig(savedSignature(finalImages));
      setSlots(toSlots(finalImages));
      setSaved(true);
      invalidateProducts();
    } catch (err) {
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    } finally {
      setIsSaving(false);
    }
  }

  const isEmpty = slots.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <label
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors active:bg-primary/10",
          isSaving && "pointer-events-none opacity-50"
        )}
      >
        <ImagePlus className="size-5" aria-hidden="true" />
        {t("addImages")}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={isSaving}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isEmpty && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) =>
                slot.kind === "existing" ? (
                  <SortableImageThumb
                    key={slot.id}
                    id={slot.id}
                    thumbnailUrl={slot.image.thumbnailUrl}
                    isPrimary={slot.isPrimary}
                    isBusy={isSaving}
                    canDelete={canDelete}
                    onTogglePrimary={handleTogglePrimary}
                    onRemove={handleRemove}
                  />
                ) : (
                  <SortableImageThumb
                    key={slot.id}
                    id={slot.id}
                    thumbnailUrl={slot.previewUrl}
                    isPrimary={slot.isPrimary}
                    isBusy={isSaving}
                    canDelete
                    isNew
                    onTogglePrimary={handleTogglePrimary}
                    onRemove={handleRemove}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isEmpty && emptyHint && <p className="text-sm text-muted-foreground">{emptyHint}</p>}

      {saved && !isDirty && <Alert variant="success">{t("saveSuccess")}</Alert>}

      {isDirty && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("unsavedHint")}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Spinner />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isSaving}>
              {t("discard")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
