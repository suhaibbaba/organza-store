import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_SUMMARY_QUERY_KEY } from "@/constants/api";
import { fetchDashboardSummary } from "@/lib/api/dashboard";

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY,
    queryFn: fetchDashboardSummary,
    staleTime: 60 * 1000,
  });
}
