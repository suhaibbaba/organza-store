import type { Product } from "@organza/shared/types/product";
import type { ProductImageRef } from "@organza/shared/types/variant";
import type { ImageEdit } from "@organza/shared/lib/imageEdit";
import { PRODUCT_GALLERY_KEY, variantGalleryKey } from "@/constants/images";
import { validateImageFile } from "@/lib/validation/image";
import type { Gallery, GallerySlot } from "@/types/productForm";

// Pure helpers for a working gallery. Everything here is local state only —
// picking, removing, reordering and choosing the main photo all happen in the
// form and are written to the server once, by the form's single Save (see
// lib/image-sync.ts). No component here talks to the API.

export function toSlots(images: ProductImageRef[]): GallerySlot[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ kind: "existing" as const, id: image.id, image, isPrimary: image.isPrimary }));
}

export function toGallery(images: ProductImageRef[]): Gallery {
  return { slots: toSlots(images), saved: images };
}

// Every gallery on the product form, keyed for the save to walk: the
// product's own, plus one per variant. A brand-new product starts with a
// single empty gallery — the files picked into it are uploaded the moment
// the product exists.
export function initGalleries(product?: Product): Record<string, Gallery> {
  const galleries: Record<string, Gallery> = {
    [PRODUCT_GALLERY_KEY]: toGallery(product?.images ?? []),
  };

  // A variant with no photos of its own reports the product's instead (the
  // API resolves that fallback at read time, CLAUDE.md rule 3), and those
  // rows belong to the product — sending them as the variant's own gallery
  // would be rejected as a mismatched set. An id is unique to one owner, so
  // anything also in the product's gallery is inherited, not owned.
  const productImageIds = new Set((product?.images ?? []).map((i) => i.id));
  for (const variant of product?.variants ?? []) {
    const own = variant.images.filter((image) => !productImageIds.has(image.id));
    galleries[variantGalleryKey(variant.id)] = toGallery(own);
  }

  return galleries;
}

// Order + membership + primary, as a comparable string: what the working copy
// is diffed against to know whether this gallery has anything to save.
function savedSignature(images: ProductImageRef[]): string {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => `${i.id}:${i.isPrimary ? 1 : 0}`)
    .join("|");
}

// A re-framing chosen but not sent counts as a change, so the form's Save
// lights up for it exactly as it does for a reorder — otherwise somebody
// crops a photograph, sees the new preview, and finds nothing to press.
function workingSignature(slots: GallerySlot[]): string {
  return slots
    .map((s) => `${s.kind === "existing" ? s.id : "new"}:${s.isPrimary ? 1 : 0}:${s.edit ? "edited" : ""}`)
    .join("|");
}

export function galleryChanged(gallery: Gallery): boolean {
  return workingSignature(gallery.slots) !== savedSignature(gallery.saved);
}

// Photos picked but not yet uploaded — what the progress counter counts and
// what a retry would try again.
export function pendingCount(slots: GallerySlot[]): number {
  return slots.filter((s) => s.kind === "new").length;
}

// There must be exactly one main photo while the gallery isn't empty: adding
// the first photos, or removing the current main, promotes whatever is first.
function withOnePrimary(slots: GallerySlot[]): GallerySlot[] {
  if (slots.length === 0 || slots.some((s) => s.isPrimary)) return slots;
  return slots.map((s, i) => (i === 0 ? { ...s, isPrimary: true } : s));
}

// Adds every file that passes the local pre-check; returns the first rejected
// file's error code (an `error.*` key) so the caller can show it via t().
export function appendFiles(
  slots: GallerySlot[],
  files: File[]
): { slots: GallerySlot[]; rejectedCode: string | null } {
  const added: GallerySlot[] = [];
  let rejectedCode: string | null = null;

  for (const file of files) {
    const invalidCode = validateImageFile(file);
    if (invalidCode) {
      rejectedCode ??= invalidCode;
      continue;
    }
    // One object URL, used twice to begin with: `sourceUrl` is the picked
    // file and stays that way — it is what the editor re-opens on, so a
    // second pass at the crop starts from the whole photograph — while
    // `previewUrl` is whatever the tile should show, and is replaced by the
    // cropped preview once the editor has been through it.
    const objectUrl = URL.createObjectURL(file);
    added.push({
      kind: "new",
      id: `new-${crypto.randomUUID()}`,
      file,
      previewUrl: objectUrl,
      sourceUrl: objectUrl,
      isPrimary: false,
      edit: null,
    });
  }

  return { slots: withOnePrimary([...slots, ...added]), rejectedCode };
}

export function removeSlot(slots: GallerySlot[], id: string): GallerySlot[] {
  const removed = slots.find((s) => s.id === id);
  if (removed) revokeSlotUrls(removed);
  return withOnePrimary(slots.filter((s) => s.id !== id));
}

/**
 * Hands back the memory a slot is holding.
 *
 * Every preview is an object URL, and a cropped one is a second URL on top of
 * the picked file's. They are only reclaimed when revoked — a form where
 * somebody adds, crops and removes a dozen photographs while looking for the
 * right one would otherwise hold every one of them until the page reloads.
 */
function revokeSlotUrls(slot: GallerySlot): void {
  if (slot.kind === "new") {
    if (slot.previewUrl !== slot.sourceUrl) URL.revokeObjectURL(slot.previewUrl);
    URL.revokeObjectURL(slot.sourceUrl);
    return;
  }
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
}

/**
 * Record what the editor framed for one photo, with the preview it drew.
 *
 * Nothing is sent here either: an edit is part of the gallery's working copy
 * and goes to the server with everything else when the form is saved (see
 * lib/image-sync.ts). `preview` is null when the browser could not draw one,
 * and the tile then keeps the picture it had.
 */
export function applyEditToSlot(
  slots: GallerySlot[],
  id: string,
  // Null when the editor was opened and left as it was: nothing to store, and
  // nothing for the save to send.
  edit: ImageEdit | null,
  preview: string | null
): GallerySlot[] {
  return slots.map((slot) => {
    if (slot.id !== id) return slot;
    // The previous preview is this slot's alone and nothing else can be
    // pointing at it; a second crop would otherwise leak the first.
    if (slot.kind === "new") {
      if (slot.previewUrl !== slot.sourceUrl) URL.revokeObjectURL(slot.previewUrl);
      return { ...slot, edit, previewUrl: preview ?? slot.sourceUrl };
    }
    if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    return { ...slot, edit, previewUrl: preview };
  });
}

// A tap always *sets* this slot as the main photo; tapping the current main
// does nothing rather than leaving the gallery with none.
export function setPrimarySlot(slots: GallerySlot[], id: string): GallerySlot[] {
  return slots.map((s) => ({ ...s, isPrimary: s.id === id }));
}

export function moveSlot(slots: GallerySlot[], fromId: string, toId: string): GallerySlot[] {
  const from = slots.findIndex((s) => s.id === fromId);
  const to = slots.findIndex((s) => s.id === toId);
  if (from === -1 || to === -1 || from === to) return slots;
  const next = [...slots];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
