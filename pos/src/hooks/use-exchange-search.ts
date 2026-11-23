import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { EXCHANGE_ORDERS_QUERY_KEY } from "@/constants/api";
import { EXCHANGE_SEARCH_DEBOUNCE_MS } from "@/constants/exchange";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchSalesForExchange } from "@/lib/api/orders";
import type { ExchangeSearch } from "@/types/exchange";

// Past sales to take pieces back from: the recent history until something is typed or scanned, then the matches.
export function useExchangeSearch(search: ExchangeSearch, enabled: boolean) {
  const debouncedQ = useDebouncedValue(search.q ?? "", EXCHANGE_SEARCH_DEBOUNCE_MS);
  const effective: ExchangeSearch = search.itemCode ? { itemCode: search.itemCode } : { q: debouncedQ || undefined };

  const result = useInfiniteQuery({
    queryKey: [...EXCHANGE_ORDERS_QUERY_KEY, effective.itemCode ?? "", effective.q ?? ""],
    queryFn: ({ pageParam }) => searchSalesForExchange(effective, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta || meta.page >= meta.totalPages) {
        return undefined;
      }
      return meta.page + 1;
    },
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    orders: result.data?.pages.flatMap((page) => page.orders) ?? [],
    isTyping: (search.q ?? "") !== debouncedQ,
  };
}
