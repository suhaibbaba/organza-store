import type { ProductImageRef } from "@store/shared/types/variant";
import type { ImageEdit } from "@store/shared/lib/imageEdit";
import { apiFetch } from "@/lib/api/client";

export type ImageOwner = { productId: string } | { variantId: string };

function ownerBody(owner: ImageOwner): { productId?: string; variantId?: string } {
  return "productId" in owner ? { productId: owner.productId } : { variantId: owner.variantId };
}

// The file as picked plus the framing; sharp cuts from the original, which is kept for later re-framing.
export async function uploadImage(
  owner: ImageOwner,
  file: File,
  edit: ImageEdit | null = null,
): Promise<ProductImageRef> {
  const formData = new FormData();
  formData.append("file", file);
  if (edit) {
    formData.append("edit", JSON.stringify(edit));
  }
  const ownerField = ownerBody(owner);
  if (ownerField.productId) {
    formData.append("productId", ownerField.productId);
  }
  if (ownerField.variantId) {
    formData.append("variantId", ownerField.variantId);
  }

  const { data } = await apiFetch<ProductImageRef>("/api/images", { method: "POST", body: formData });
  return data;
}

// New file names on purpose, so nothing keeps showing the replaced framing.
export async function editImage(imageId: string, edit: ImageEdit): Promise<ProductImageRef> {
  const { data } = await apiFetch<ProductImageRef>(`/api/images/${imageId}/edit`, {
    method: "PATCH",
    body: { edit },
  });
  return data;
}

export async function reorderImages(owner: ImageOwner, imageIds: string[]): Promise<ProductImageRef[]> {
  const { data } = await apiFetch<ProductImageRef[]>("/api/images/reorder", {
    method: "PATCH",
    body: { ...ownerBody(owner), imageIds },
  });
  return data;
}

export async function setPrimaryImage(imageId: string, isPrimary: boolean): Promise<ProductImageRef> {
  const { data } = await apiFetch<ProductImageRef>(`/api/images/${imageId}`, {
    method: "PATCH",
    body: { isPrimary },
  });
  return data;
}

// Gated: without images.delete it files a request; `deleted` says which happened.
export async function deleteImage(imageId: string): Promise<{ id: string; deleted: boolean }> {
  const { data } = await apiFetch<{ id: string; deleted?: boolean }>(`/api/images/${imageId}`, {
    method: "DELETE",
  });
  // Older backends answered without the flag, and they only ever deleted.
  return { id: data.id, deleted: data.deleted ?? true };
}
