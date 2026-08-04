import type { Product, ProductLookupResult, ProductSummary } from "@shared/types/product";
import { apiFetch } from "@/lib/api/client";
import { SEARCH_PAGE, SEARCH_PAGE_SIZE } from "@/constants/pos";

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
