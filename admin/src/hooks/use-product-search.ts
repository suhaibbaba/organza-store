import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ORDER_PRODUCT_SEARCH_DEBOUNCE_MS,
  ORDER_PRODUCT_SEARCH_MIN_QUERY_LENGTH,
  ORDER_PRODUCT_SEARCH_PAGE,
  ORDER_PRODUCT_SEARCH_PAGE_SIZE,
  ORDER_PRODUCT_SEARCH_STATUS,
} from "@/constants/orders";
import { DEFAULT_PRODUCT_FILTERS, PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchProducts } from "@/lib/api/products";
import type { ProductListFilters } from "@/types/product";

// Search-as-you-type over the backend's cross-language fuzzy search
// (CLAUDE.md rule 10), reusing the same products endpoint the catalogue
// screens use. Previous results stay on screen while the next query resolves
// (keepPreviousData) so the list never blinks empty between keystrokes.
export function useProductSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), ORDER_PRODUCT_SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= ORDER_PRODUCT_SEARCH_MIN_QUERY_LENGTH;

  const filters: ProductListFilters = {
    ...DEFAULT_PRODUCT_FILTERS,
    q: debounced,
    // Hidden products aren't for sale, so they don't belong in an order.
    status: ORDER_PRODUCT_SEARCH_STATUS,
    page: ORDER_PRODUCT_SEARCH_PAGE,
  };

  const result = useQuery({
    queryKey: [PRODUCT_LIST_QUERY_KEY, "search", filters],
    queryFn: () => fetchProducts(filters, ORDER_PRODUCT_SEARCH_PAGE_SIZE),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    // The user has typed something the debounce hasn't caught up with yet:
    // shown as loading rather than as stale results for a different query.
    isTyping: query.trim() !== debounced,
    isActive: enabled,
  };
}
