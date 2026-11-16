import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PRODUCT_SEARCH_QUERY_KEY } from "@/constants/api";
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from "@/constants/pos";
import { STOCK_POLL_INTERVAL_MS } from "@/constants/polling";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchProducts } from "@/lib/api/products";

// Search-as-you-type over the backend's cross-language fuzzy search. The
// previous results stay on screen while the next query resolves
// (keepPreviousData) so the list never blinks empty between keystrokes —
// on a phone at the counter that flicker reads as "it lost my search".
//
// Every row carries a stock badge, and a shop with more than one till is a
// shop where those numbers go out of date while they are being looked at. So
// the list re-reads itself on a timer, and the same keepPreviousData that
// stops the blink between keystrokes is what makes that invisible: the rows
// on screen stay exactly where they are, `isPending` never goes true, and the
// only thing that changes is a badge whose figure moved.
export function useProductSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debounced.length >= SEARCH_MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: [...PRODUCT_SEARCH_QUERY_KEY, debounced],
    queryFn: () => searchProducts(debounced),
    enabled,
    placeholderData: keepPreviousData,
    // Stock is never worth holding: a result read a minute ago may already
    // have been sold by the till at the other end of the counter. Zero here
    // is also what makes coming back to the app re-read it — refetchOnWindow-
    // Focus and refetchOnReconnect only touch queries that are stale.
    staleTime: 0,
    refetchInterval: STOCK_POLL_INTERVAL_MS,
    // Left at its default deliberately: the interval keeps time while the
    // till is idle but fires no request, because react-query gates each tick
    // on focusManager.isFocused() — which lib/activity.ts drives.
    refetchIntervalInBackground: false,
  });

  return {
    ...result,
    // The user has typed something the debounce hasn't caught up with yet:
    // shown as loading rather than as stale results for a different query.
    isTyping: query.trim() !== debounced,
    isActive: enabled,
  };
}
