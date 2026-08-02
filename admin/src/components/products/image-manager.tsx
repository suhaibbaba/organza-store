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
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus } from "lucide-react";
import type { ProductImageRef } from "@shared/types/variant";
import { useTranslateError } from "@/hooks/use-translate-error";
import { validateImageFile } from "@/lib/validation/image";
import { uploadImage, reorderImages, setPrimaryImage, deleteImage, type ImageOwner } from "@/lib/api/images";
import { SortableImageThumb } from "@/components/products/sortable-image-thumb";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";

interface PendingUpload {
  id: string;
  previewUrl: string;
}

interface ImageManagerProps {
  owner: ImageOwner;
  initialImages: ProductImageRef[];
  canDelete: boolean;
  emptyHint?: string;
}

// Self-contained: every action (upload/reorder/set-primary/delete) is its
// own immediate API call, not batched into the surrounding form's submit —
// so this works the same whether it's rendered inside the main edit form or
// a read-only-for-details Employee view (spec.md: "edit images" is an
// Employee capability independent of editing product/variant details).
export function ImageManager({ owner, initialImages, canDelete, emptyHint }: ImageManagerProps) {
  const t = useTranslations("products.form.images");
  const translateError = useTranslateError();
  const [images, setImages] = useState<ProductImageRef[]>(initialImages);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  // Uploaded one at a time on purpose: the backend assigns each new image's
  // sortOrder from the current count for its owner, so concurrent uploads
  // for the same product/variant could race and collide.
  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    for (const file of Array.from(fileList)) {
      const invalidCode = validateImageFile(file);
      if (invalidCode) {
        setError(translateError(invalidCode));
        continue;
      }

      const tempId = `pending-${crypto.randomUUID()}`;
      const previewUrl = URL.createObjectURL(file);
      setPending((prev) => [...prev, { id: tempId, previewUrl }]);
      try {
        const created = await uploadImage(owner, file);
        setImages((prev) => [...prev, created]);
      } catch (err) {
        setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
      } finally {
        setPending((prev) => prev.filter((p) => p.id !== tempId));
        URL.revokeObjectURL(previewUrl);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  async function persistReorder(reordered: ProductImageRef[]) {
    const previous = images;
    setImages(reordered);
    try {
      const updated = await reorderImages(owner, reordered.map((i) => i.id));
      setImages(updated);
    } catch (err) {
      setImages(previous);
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    void persistReorder(arrayMove(images, oldIndex, newIndex));
  }

  async function handleTogglePrimary(imageId: string, next: boolean) {
    setError(null);
    setBusyId(imageId);
    try {
      const updated = await setPrimaryImage(imageId, next);
      setImages((prev) => prev.map((img) => (img.id === imageId ? updated : next ? { ...img, isPrimary: false } : img)));
    } catch (err) {
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(imageId: string) {
    setConfirmDeleteId(null);
    setError(null);
    const previous = images;
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setBusyId(imageId);
    try {
      await deleteImage(imageId);
    } catch (err) {
      setImages(previous);
      setError(translateError(err instanceof ApiError ? err.code : "error.internal"));
    } finally {
      setBusyId(null);
    }
  }

  const isEmpty = images.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors active:bg-primary/10">
        <ImagePlus className="size-5" aria-hidden="true" />
        {t("addImages")}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isEmpty && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {images.map((image) => (
                <SortableImageThumb
                  key={image.id}
                  image={image}
                  isBusy={busyId === image.id}
                  canDelete={canDelete}
                  isConfirmingDelete={confirmDeleteId === image.id}
                  onTogglePrimary={handleTogglePrimary}
                  onRequestDelete={setConfirmDeleteId}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={handleDelete}
                />
              ))}
              {pending.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                  <div
                    className="size-full bg-cover bg-center opacity-60"
                    style={{ backgroundImage: `url(${p.previewUrl})` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner />
                  </div>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isEmpty && emptyHint && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
    </div>
  );
}
