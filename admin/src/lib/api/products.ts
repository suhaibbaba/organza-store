import type { Product, ProductSummary } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
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

export async function deleteVariant(id: string, variantId: string): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>(`/api/products/${id}/variants/${variantId}`, { method: "DELETE" });
  return data;
}
