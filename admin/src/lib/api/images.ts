import type { ProductImageRef } from "@shared/types/variant";
import { apiFetch } from "@/lib/api/client";

export type ImageOwner = { productId: string } | { variantId: string };

function ownerBody(owner: ImageOwner): { productId?: string; variantId?: string } {
  return "productId" in owner ? { productId: owner.productId } : { variantId: owner.variantId };
}

export async function uploadImage(owner: ImageOwner, file: File): Promise<ProductImageRef> {
  const formData = new FormData();
  formData.append("file", file);
  const ownerField = ownerBody(owner);
  if (ownerField.productId) formData.append("productId", ownerField.productId);
  if (ownerField.variantId) formData.append("variantId", ownerField.variantId);

  const { data } = await apiFetch<ProductImageRef>("/api/images", { method: "POST", body: formData });
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

export async function deleteImage(imageId: string): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>(`/api/images/${imageId}`, { method: "DELETE" });
  return data;
}
