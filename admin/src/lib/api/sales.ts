import { apiFetch } from "@/lib/api/client";
import { timezoneOffsetMinutes } from "@/lib/report-range";
import type { SalesPeriod, TopSeller } from "@/types/report";
import type { SalesLogFilters, SoldItemsPage } from "@/types/sales";

function rangeParams(from: string, to: string): URLSearchParams {
  return new URLSearchParams({ from, to, tzOffset: String(timezoneOffsetMinutes()) });
}

export async function fetchSalesPeriod(from: string, to: string): Promise<SalesPeriod> {
  const { data } = await apiFetch<SalesPeriod>(`/api/reports/period?${rangeParams(from, to).toString()}`);
  return data;
}

export async function fetchSoldItems(from: string, to: string, filters: SalesLogFilters): Promise<SoldItemsPage> {
  const params = rangeParams(from, to);
  params.set("sortBy", filters.sortBy);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const { data, meta } = await apiFetch<TopSeller[]>(`/api/reports/sold-items?${params.toString()}`);
  return { items: data, meta };
}
