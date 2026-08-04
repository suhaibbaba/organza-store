import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  REPORTS_SALES_QUERY_KEY,
  REPORTS_STALE_TIME_MS,
  REPORTS_SUMMARY_QUERY_KEY,
} from "@/constants/reports";
import { fetchSalesReport, fetchSalesSummary } from "@/lib/api/reports";

// The dashboard's Sales & Profit block: today / this week / this month.
export function useSalesSummaryQuery() {
  return useQuery({
    queryKey: REPORTS_SUMMARY_QUERY_KEY,
    queryFn: fetchSalesSummary,
    staleTime: REPORTS_STALE_TIME_MS,
  });
}

// The Reports page, for one picked range.
export function useSalesReportQuery(from: string, to: string) {
  return useQuery({
    queryKey: [REPORTS_SALES_QUERY_KEY, from, to],
    queryFn: () => fetchSalesReport(from, to),
    enabled: Boolean(from && to),
    staleTime: REPORTS_STALE_TIME_MS,
    // Keeps the previous range's figures on screen while the next one loads,
    // so changing the dates doesn't blank the whole page.
    placeholderData: keepPreviousData,
  });
}
