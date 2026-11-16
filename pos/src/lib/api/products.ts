import type { Pagination } from "@organza/shared/types/common";
import type { Product, ProductLookupResult, ProductSummary } from "@organza/shared/types/product";
import { apiFetch } from "@/lib/api/client";
import { BROWSE_PAGE_SIZE, SEARCH_PAGE, SEARCH_PAGE_SIZE } from "@/constants/pos";

// Cross-language, typo-tolerant search already lives on the backend
// (CLAUDE.md rule 10) — the POS just asks for it. `status=active` keeps
// hidden products out of the counter's results; they aren't for sale.
export async function searchProducts(query: string): Promise<ProductSummary[]> {
  const params = new URLSearchParams({
    q: query,
    page: String(SEARCH_PAGE),
    pageSize: String(SEARCH_PAGE_SIZE),
    status: "active",
  });
  const { data } = await apiFetch<ProductSummary[]>(`/api/products?${params.toString()}`);
  return data;
}

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

// A page of the product browser's grid: one category (or all of them),
// narrowed by the drawer's own search box.
//
// The same list endpoint the admin uses, and — when there is a query — the
// same cross-language, typo-tolerant search the box at the top of the selling
// screen runs (CLAUDE.md rule 10). Nothing about finding a product is
// reimplemented here; the drawer only asks for it a category at a time.
//
// `includeSubcategories` is what makes tapping a parent shelf work: products
// hang off leaves, so "Women" without it answers with the handful filed
// directly on the parent and looks broken. `status=active` keeps hidden
// products out, exactly as the search box does — they are not for sale.
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
  if (trimmed) params.set("q", trimmed);

  const { data, meta } = await apiFetch<ProductSummary[]>(`/api/products?${params.toString()}`);
  return { products: data, meta };
}

// One scanned barcode (or a SKU read off the label by hand) resolved to the
// exact item being sold — the variant when the code was a variant's own.
export async function lookupProductByCode(code: string): Promise<ProductLookupResult> {
  const params = new URLSearchParams({ code });
  const { data } = await apiFetch<ProductLookupResult>(`/api/products/lookup?${params.toString()}`);
  return data;
}

// Full detail, fetched when a search result the cashier tapped turns out to
// have variants: the list DTO carries no per-variant breakdown, and the
// picker needs each variant's own price and stock.
export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await apiFetch<Product>(`/api/products/${id}`);
  return data;
}
