import type { ProductImageRef } from "@store/shared/types/variant";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { deleteImage, editImage, reorderImages, setPrimaryImage, uploadImage, type ImageOwner } from "@/lib/api/images";
import { ApiError } from "@/lib/api/errors";
import { pendingCount } from "@/lib/image-slots";
import type { Gallery, GallerySlot, ImageSyncOutcome } from "@/types/productForm";

// Uploads, re-cuts, deletes, reorders, then sets the main photo, in that order; failures are recorded, never thrown.

function errorCodeOf(err: unknown): string {
  return err instanceof ApiError ? err.code : ERROR_CODES.INTERNAL;
}

export async function syncGallery(
  owner: ImageOwner,
  gallery: Gallery,
  onUploadSettled?: () => void,
): Promise<ImageSyncOutcome> {
  const { slots, saved } = gallery;
  let errorCode: string | null = null;

  // Kept in step with the calls below, so the reorder gets the exact set the server has.
  const onServer = new Map<string, ProductImageRef>(saved.map((i) => [i.id, i]));
  const keptIds = new Set(slots.filter((s) => s.kind === "existing").map((s) => s.id));

  // 1. Uploads, in the order the user arranged them.
  const working: GallerySlot[] = [];
  for (const slot of slots) {
    if (slot.kind === "existing") {
      working.push(slot);
      continue;
    }
    try {
      const created = await uploadImage(owner, slot.file, slot.edit);
      URL.revokeObjectURL(slot.previewUrl);
      if (slot.sourceUrl !== slot.previewUrl) {
        URL.revokeObjectURL(slot.sourceUrl);
      }
      onServer.set(created.id, created);
      working.push({ kind: "existing", id: created.id, image: created, isPrimary: slot.isPrimary });
    } catch (err) {
      errorCode ??= errorCodeOf(err);
      // Left pending exactly as it was, so a retry re-uploads only this one.
      working.push(slot);
    }
    onUploadSettled?.();
  }

  // 2. Re-framings: a failure keeps the crop pending for a retry and never blocks the rest.
  for (const [index, slot] of working.entries()) {
    if (slot.kind !== "existing" || !slot.edit) {
      continue;
    }
    try {
      const updated = await editImage(slot.id, slot.edit);
      onServer.set(updated.id, updated);
      if (slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
      working[index] = { ...slot, image: updated, edit: null, previewUrl: null };
    } catch (err) {
      errorCode ??= errorCodeOf(err);
    }
  }

  // 3. Deletions: a failed or approval-held one stays in the gallery and in the reorder set.
  let awaitingApproval = 0;
  for (const image of saved) {
    if (keptIds.has(image.id)) {
      continue;
    }
    try {
      const result = await deleteImage(image.id);
      if (result.deleted) {
        onServer.delete(image.id);
      } else {
        awaitingApproval += 1;
        working.push({ kind: "existing", id: image.id, image, isPrimary: false });
      }
    } catch (err) {
      errorCode ??= errorCodeOf(err);
      working.push({ kind: "existing", id: image.id, image, isPrimary: false });
    }
  }

  // 4. Order + main photo, over what is genuinely on the server now.
  const orderedIds = working.filter((s) => s.kind === "existing").map((s) => s.id);
  let images: ProductImageRef[] = orderedIds.map((id) => onServer.get(id)).filter(Boolean) as ProductImageRef[];

  if (orderedIds.length > 0) {
    try {
      images = await reorderImages(owner, orderedIds);
      const primaryId = (working.find((s) => s.kind === "existing" && s.isPrimary) ?? working[0])?.id;
      if (primaryId && !images.find((i) => i.id === primaryId)?.isPrimary) {
        const updated = await setPrimaryImage(primaryId, true);
        images = images.map((i) => (i.id === primaryId ? updated : { ...i, isPrimary: false }));
      }
    } catch (err) {
      errorCode ??= errorCodeOf(err);
    }
  }

  const byId = new Map(images.map((i) => [i.id, i]));
  const settled: GallerySlot[] = working.map((slot) => {
    if (slot.kind !== "existing") {
      return slot;
    }
    const stored = byId.get(slot.id);
    return stored ? { ...slot, image: stored, isPrimary: stored.isPrimary } : slot;
  });

  return { images, slots: settled, pendingCount: pendingCount(settled), awaitingApproval, errorCode };
}
