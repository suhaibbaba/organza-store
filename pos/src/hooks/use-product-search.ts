import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PRODUCT_SEARCH_QUERY_KEY } from "@/constants/api";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from "@/constants/pos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchProducts } from "@/lib/api/products";

// Search-as-you-type over the backend's cross-language fuzzy search. The
// previous results stay on screen while the next query resolves
// (keepPreviousData) so the list never blinks empty between keystrokes —
// on a phone at the counter that flicker reads as "it lost my search".
export function useProductSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: [...PRODUCT_SEARCH_QUERY_KEY, debounced],
    queryFn: () => searchProducts(debounced),
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
