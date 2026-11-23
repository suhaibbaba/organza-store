import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { REPORTS_STALE_TIME_MS } from "@/constants/reports";
import { SALES_PERIOD_QUERY_KEY, SOLD_ITEMS_QUERY_KEY } from "@/constants/sales";
import { fetchSalesPeriod, fetchSoldItems } from "@/lib/api/sales";
import type { SalesLogFilters } from "@/types/sales";

// Paging and sort don't change a total, so the headline is keyed on the range alone.
export function useSalesPeriodQuery(from: string, to: string) {
  return useQuery({
    queryKey: [SALES_PERIOD_QUERY_KEY, from, to],
    queryFn: () => fetchSalesPeriod(from, to),
    enabled: Boolean(from && to),
    staleTime: REPORTS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

export function useSoldItemsQuery(from: string, to: string, filters: SalesLogFilters) {
  return useQuery({
    queryKey: [SOLD_ITEMS_QUERY_KEY, from, to, filters.sortBy, filters.page, filters.pageSize],
    queryFn: () => fetchSoldItems(from, to, filters),
    enabled: Boolean(from && to),
    staleTime: REPORTS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
