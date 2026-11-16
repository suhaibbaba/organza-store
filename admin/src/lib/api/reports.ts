import { apiFetch } from "@/lib/api/client";
import { timezoneOffsetMinutes } from "@/lib/report-range";
import { TOP_SELLERS_LIMIT } from "@/constants/reports";
import type { SalesReport, SalesSummary } from "@/types/report";

// Cost, profit and margin are simply absent from these responses for roles
// without product.viewCost — the backend never puts them in (CLAUDE.md rule
// 19), so the UI checks for their presence rather than for a role.

export async function fetchSalesSummary(): Promise<SalesSummary> {
  const params = new URLSearchParams({ tzOffset: String(timezoneOffsetMinutes()) });
  const { data } = await apiFetch<SalesSummary>(`/api/reports/sales-summary?${params.toString()}`);
  return data;
}

export async function fetchSalesReport(from: string, to: string): Promise<SalesReport> {
  const params = new URLSearchParams({
    from,
    to,
    tzOffset: String(timezoneOffsetMinutes()),
    topLimit: String(TOP_SELLERS_LIMIT),
  });
  const { data } = await apiFetch<SalesReport>(`/api/reports/sales?${params.toString()}`);
  return data;
}
