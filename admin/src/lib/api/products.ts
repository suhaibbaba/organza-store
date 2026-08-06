import type { MarkLabelsPrintedResult, Product, ProductSummary } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import type { ChangeRequest } from "@shared/types/changeRequest";
import type { Pagination } from "@shared/types/common";
import type {
  CreateProductInput,
  UpdateProductInput,
  GenerateVariantsInput,
  UpdateVariantInput,
} from "@shared/schemas/product";
import { apiFetch } from "@/lib/api/client";
import type { ProductListFilters } from "@/types/product";

function buildProductListQuery(filters: ProductListFilters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.status) params.set("status", filters.status);
  if (filters.stock) params.set("stock", filters.stock);
  if (filters.priceMin.trim()) params.set("priceMin", filters.priceMin.trim());
  if (filters.priceMax.trim()) params.set("priceMax", filters.priceMax.trim());
  // "all" is the backend's own default — left off the query string so the
  // products screen's URL stays as it was.
  if (filters.printState !== "all") params.set("printState", filters.printState);
  return params.toString();
}

export async function fetchProducts(
  filters: ProductListFilters,
  pageSize: number
): Promise<{ products: ProductSummary[]; meta: Pagination | null }> {
  const query = buildProductListQuery(filters, pageSize);
  const { data, meta } = await apiFetch<ProductSummary[]>(`/api/products?${query}`);
  return { products: data, meta };
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await apiFetch<Product>(`/api/products/${id}`);
  return data;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await apiFetch<Product>("/api/products", { method: "POST", body: input });
  return data;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const { data } = await apiFetch<Product>(`/api/products/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function generateVariants(id: string, input: GenerateVariantsInput): Promise<Product> {
  const { data } = await apiFetch<Product>(`/api/products/${id}/variants/generate`, { method: "POST", body: input });
  return data;
}

export async function updateVariant(id: string, variantId: string, input: UpdateVariantInput): Promise<Variant> {
  const { data } = await apiFetch<Variant>(`/api/products/${id}/variants/${variantId}`, {
    method: "PATCH",
    body: input,
  });
  return data;
}

// Records that a batch of barcode labels went to the printer, so those
// products drop out of the "not printed yet" list. Reprinting is always
// allowed — this only ever moves the timestamp forward.
export async function markLabelsPrinted(productIds: string[]): Promise<MarkLabelsPrintedResult> {
  const { data } = await apiFetch<MarkLabelsPrintedResult>("/api/products/labels/printed", {
    method: "POST",
    body: { productIds },
  });
  return data;
}

// Soft delete (CLAUDE.md rule 4): the backend only sets deletedAt and hides
// the product — the row stays, because past orders point at it.
export async function deleteProduct(id: string): Promise<{ id: string; deletedAt: string }> {
  const { data } = await apiFetch<{ id: string; deletedAt: string }>(`/api/products/${id}`, { method: "DELETE" });
  return data;
}

/**
 * Remove one combination — or ASK for it to be removed.
 *
 * Which variants a product has is a gated change (spec.md "Employee change
 * approvals"): whoever holds product.editVariantSet removes it there and
 * then, and everyone else's attempt files a request while the variant stays
 * exactly where it is. `deleted` says which happened, so the form can report
 * "waiting" instead of showing a combination as gone when it isn't.
 */
export async function deleteVariant(
  id: string,
  variantId: string
): Promise<{ id: string; deleted: boolean; pendingChange?: ChangeRequest | null }> {
  const { data } = await apiFetch<{ id: string; deleted?: boolean; pendingChange?: ChangeRequest | null }>(
    `/api/products/${id}/variants/${variantId}`,
    { method: "DELETE" }
  );
  // Older backends answered without the flag, and they only ever deleted.
  return { id: data.id, deleted: data.deleted ?? true, pendingChange: data.pendingChange ?? null };
}
