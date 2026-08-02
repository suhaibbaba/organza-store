import type { Product, ProductSummary } from "@shared/types/product";
import type { Pagination } from "@shared/types/common";
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
