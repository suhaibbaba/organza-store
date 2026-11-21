import { apiFetch } from "@/lib/api/client";
import { timezoneOffsetMinutes } from "@/lib/report-range";
import { TOP_SELLERS_LIMIT } from "@/constants/reports";
import type { SalesReport, SalesSummary } from "@/types/report";

// Cost and profit are absent for roles without product.viewCost (rule 19): check for presence, never for a role.

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
