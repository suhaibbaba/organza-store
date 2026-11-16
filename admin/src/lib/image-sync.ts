import type { ProductImageRef } from "@organza/shared/types/variant";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { deleteImage, editImage, reorderImages, setPrimaryImage, uploadImage, type ImageOwner } from "@/lib/api/images";
import { ApiError } from "@/lib/api/errors";
import { pendingCount } from "@/lib/image-slots";
import type { Gallery, GallerySlot, ImageSyncOutcome } from "@/types/productForm";

// Writes one gallery to the server as part of the product form's single Save.
// Internally that is several calls — upload each new file (multipart), re-cut
// any photo that was re-framed, delete what was removed, reorder what
// remains, then set the main photo — and they have to run in that order: the
// reorder endpoint checks the id set matches the owner's images exactly, so
// it can only run once uploads and deletions have settled.
//
// Nothing here throws for a failed photo. On a weak connection one upload can
// die while the product itself saved perfectly, and blowing the whole save up
// would tell the user their product was lost when it wasn't. Instead each
// failure is recorded, the file stays pending in the returned slots, and the
// caller reports what got through and offers to try the rest again.

function errorCodeOf(err: unknown): string {
  return err instanceof ApiError ? err.code : ERROR_CODES.INTERNAL;
}

export async function syncGallery(
  owner: ImageOwner,
  gallery: Gallery,
  // Called after each upload attempt, successful or not, so the form can
  // count photos through ("Uploading photos (2 of 5)").
  onUploadSettled?: () => void
): Promise<ImageSyncOutcome> {
  const { slots, saved } = gallery;
  let errorCode: string | null = null;

  // Every image the server currently holds for this owner, by id — kept in
  // step with what actually happens below, so the reorder call at the end can
  // be given the exact set the server has.
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
      if (slot.sourceUrl !== slot.previewUrl) URL.revokeObjectURL(slot.sourceUrl);
      onServer.set(created.id, created);
      working.push({ kind: "existing", id: created.id, image: created, isPrimary: slot.isPrimary });
    } catch (err) {
      errorCode ??= errorCodeOf(err);
      // Left pending exactly as it was, so a retry re-uploads only this one.
      working.push(slot);
    }
    onUploadSettled?.();
  }

  // 2. Re-framings of photos that were already there. A failure leaves the
  //    photo exactly as it was — the crop is still pending in the slot, so a
  //    retry sends it again — and never blocks the rest of the save: an
  //    unsaved crop is a smaller loss than a reorder that did not happen.
  for (const [index, slot] of working.entries()) {
    if (slot.kind !== "existing" || !slot.edit) continue;
    try {
      const updated = await editImage(slot.id, slot.edit);
      onServer.set(updated.id, updated);
      // The locally drawn preview has done its job; from here the tile shows
      // what the server actually produced.
      if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      working[index] = { ...slot, image: updated, edit: null, previewUrl: null };
    } catch (err) {
      errorCode ??= errorCodeOf(err);
    }
  }

  // 3. Deletions. One that fails is still on the server, so it goes back into
  //    the gallery rather than being quietly dropped from the user's view —
  //    and stays in the set the reorder call below has to account for.
  //
  //    A photo somebody may not delete is not a failure: the backend files a
  //    request and answers `deleted: false` (spec.md "Employee change
  //    approvals"). That photo is still there, so it goes back into the
  //    gallery exactly like a failed deletion would — and the caller is told
  //    how many are waiting, so it can say so rather than reporting an error
  //    for something that worked as designed.
  let awaitingApproval = 0;
  for (const image of saved) {
    if (keptIds.has(image.id)) continue;
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

  // Re-read the primary flag from the server's answer, so what the gallery
  // shows next is what the server actually stored.
  const byId = new Map(images.map((i) => [i.id, i]));
  const settled: GallerySlot[] = working.map((slot) => {
    if (slot.kind !== "existing") return slot;
    const stored = byId.get(slot.id);
    return stored ? { ...slot, image: stored, isPrimary: stored.isPrimary } : slot;
  });

  return { images, slots: settled, pendingCount: pendingCount(settled), awaitingApproval, errorCode };
}
