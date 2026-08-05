import type { Product } from "@shared/types/product";
import type { ProductImageRef } from "@shared/types/variant";
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

function workingSignature(slots: GallerySlot[]): string {
  return slots.map((s) => `${s.kind === "existing" ? s.id : "new"}:${s.isPrimary ? 1 : 0}`).join("|");
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
    added.push({
      kind: "new",
      id: `new-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      isPrimary: false,
    });
  }

  return { slots: withOnePrimary([...slots, ...added]), rejectedCode };
}

export function removeSlot(slots: GallerySlot[], id: string): GallerySlot[] {
  const removed = slots.find((s) => s.id === id);
  if (removed?.kind === "new") URL.revokeObjectURL(removed.previewUrl);
  return withOnePrimary(slots.filter((s) => s.id !== id));
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
