import type { Pagination } from "@store/shared/types/common";
import type { Product, ProductLookupResult, ProductSummary } from "@store/shared/types/product";
import { apiFetch } from "@/lib/api/client";
import { BROWSE_PAGE_SIZE } from "@/constants/pos";

export interface BrowseProductsParams {
  // null = every category ("All" in the sidebar).
  categoryId: string | null;
  // The browser's own search box. Empty = the whole category.
  query: string;
  page: number;
}

export interface BrowseProductsResult {
  products: ProductSummary[];
  meta: Pagination | null;
}

// The admin's list endpoint, with the same cross-language search when there is a query.
export async function browseProducts({ categoryId, query, page }: BrowseProductsParams): Promise<BrowseProductsResult> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(BROWSE_PAGE_SIZE),
    status: "active",
  });
  if (categoryId) {
    params.set("categoryId", categoryId);
    params.set("includeSubcategories", "true");
  }
  const trimmed = query.trim();
  if (trimmed) {
    params.set("q", trimmed);
  }

  const { data, meta } = await apiFetch<ProductSummary[]>(`/api/products?${params.toString()}`);
  return { products: data, meta };
}

export async function lookupProductByCode(code: string): Promise<ProductLookupResult> {
  const params = new URLSearchParams({ code });
  const { data } = await apiFetch<ProductLookupResult>(`/api/products/lookup?${params.toString()}`);
  return data;
}

// The list DTO has no per-variant breakdown, and the picker needs each variant's price and stock.
export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await apiFetch<Product>(`/api/products/${id}`);
  return data;
}

// Only the list's total is read, so one row is asked for.
export async function countActiveProducts(): Promise<number> {
  const params = new URLSearchParams({ page: "1", pageSize: "1", status: "active" });
  const { meta } = await apiFetch<ProductSummary[]>(`/api/products?${params.toString()}`);
  return meta?.total ?? 0;
}
