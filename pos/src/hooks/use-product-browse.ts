import { useInfiniteQuery } from "@tanstack/react-query";
import { PRODUCT_BROWSE_QUERY_KEY } from "@/constants/api";
import { SEARCH_DEBOUNCE_MS } from "@/constants/pos";
import { STOCK_POLL_INTERVAL_MS } from "@/constants/polling";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { browseProducts } from "@/lib/api/products";

interface UseProductBrowseOptions {
  categoryId: string | null;
  query: string;
}

// Paged (rule 15) and accumulated, so "Show more" adds rows instead of jumping back to the top.
export function useProductBrowse({ categoryId, query }: UseProductBrowseOptions) {
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  const result = useInfiniteQuery({
    queryKey: [...PRODUCT_BROWSE_QUERY_KEY, categoryId ?? "all", debounced],
    queryFn: ({ pageParam }) => browseProducts({ categoryId, query: debounced, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta || meta.page >= meta.totalPages) {
        return undefined;
      }
      return meta.page + 1;
    },
    // Always stale: another till can move the stock badges; refreshes replace pages in place.
    staleTime: 0,
    refetchInterval: STOCK_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  return {
    ...result,
    products: result.data?.pages.flatMap((page) => page.products) ?? undefined,
    total: result.data?.pages[0]?.meta?.total ?? null,
    isTyping: query.trim() !== debounced,
  };
}
