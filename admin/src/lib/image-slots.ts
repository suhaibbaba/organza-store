import type { Product } from "@organza/shared/types/product";
import type { ProductImageRef } from "@organza/shared/types/variant";
import type { ImageEdit } from "@organza/shared/lib/imageEdit";
import { PRODUCT_GALLERY_KEY, variantGalleryKey } from "@/constants/images";
import { validateImageFile } from "@/lib/validation/image";
import type { Gallery, GallerySlot } from "@/types/productForm";

export function toSlots(images: ProductImageRef[]): GallerySlot[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ kind: "existing" as const, id: image.id, image, isPrimary: image.isPrimary }));
}

export function toGallery(images: ProductImageRef[]): Gallery {
  return { slots: toSlots(images), saved: images };
}

export function initGalleries(product?: Product): Record<string, Gallery> {
  const galleries: Record<string, Gallery> = {
    [PRODUCT_GALLERY_KEY]: toGallery(product?.images ?? []),
  };

  const productImageIds = new Set((product?.images ?? []).map((i) => i.id));
  for (const variant of product?.variants ?? []) {
    const own = variant.images.filter((image) => !productImageIds.has(image.id));
    galleries[variantGalleryKey(variant.id)] = toGallery(own);
  }

  return galleries;
}

function savedSignature(images: ProductImageRef[]): string {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => `${i.id}:${i.isPrimary ? 1 : 0}`)
    .join("|");
}

function workingSignature(slots: GallerySlot[]): string {
  return slots
    .map((s) => `${s.kind === "existing" ? s.id : "new"}:${s.isPrimary ? 1 : 0}${s.edit ? ":edited" : ""}`)
    .join("|");
}

export function galleryChanged(gallery: Gallery): boolean {
  return workingSignature(gallery.slots) !== savedSignature(gallery.saved);
}

export function pendingCount(slots: GallerySlot[]): number {
  return slots.filter((s) => s.kind === "new").length;
}

// The main photo is always the first one (spec.md: lowest sortOrder = primary).
function primaryFirst(slots: GallerySlot[]): GallerySlot[] {
  return slots.map((s, i) => (s.isPrimary === (i === 0) ? s : { ...s, isPrimary: i === 0 }));
}

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

  return { slots: primaryFirst([...slots, ...added]), rejectedCode };
}

export function removeSlot(slots: GallerySlot[], id: string): GallerySlot[] {
  const removed = slots.find((s) => s.id === id);
  if (removed) revokeSlotUrls(removed);
  return primaryFirst(slots.filter((s) => s.id !== id));
}

function revokeSlotUrls(slot: GallerySlot): void {
  if (slot.kind === "new") {
    if (slot.previewUrl !== slot.sourceUrl) URL.revokeObjectURL(slot.previewUrl);
    URL.revokeObjectURL(slot.sourceUrl);
    return;
  }
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
}

export function applyEditToSlot(
  slots: GallerySlot[],
  id: string,
  edit: ImageEdit | null,
  preview: string | null
): GallerySlot[] {
  return slots.map((slot) => {
    if (slot.id !== id) return slot;
    if (slot.kind === "new") {
      if (slot.previewUrl !== slot.sourceUrl) URL.revokeObjectURL(slot.previewUrl);
      return { ...slot, edit, previewUrl: preview ?? slot.sourceUrl };
    }
    if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    return { ...slot, edit, previewUrl: preview };
  });
}

export function setPrimarySlot(slots: GallerySlot[], id: string): GallerySlot[] {
  const chosen = slots.find((s) => s.id === id);
  if (!chosen) return slots;
  return primaryFirst([chosen, ...slots.filter((s) => s.id !== id)]);
}

export function moveSlot(slots: GallerySlot[], fromId: string, toId: string): GallerySlot[] {
  const from = slots.findIndex((s) => s.id === fromId);
  const to = slots.findIndex((s) => s.id === toId);
  if (from === -1 || to === -1 || from === to) return slots;
  const next = [...slots];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return primaryFirst(next);
}
