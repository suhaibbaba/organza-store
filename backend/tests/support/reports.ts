// Helpers for the Reports suite.
//
// The suite runs against a LIVE API whose database already holds other
// sales, so nothing here asserts an absolute total. Instead every test takes
// a snapshot of the report, makes a sale, and asserts on the DIFFERENCE —
// which is exactly the figure under test and is immune to whatever else the
// sandbox contains.
import { apiRequest } from "@tests/support/client";
import { MS_PER_DAY } from "@/constants";
import type { ApiResult, SalesReport, SalesSummary, SalesTotals } from "@tests/types";

// A UTC window that always contains the moment the suite runs, even if that
// moment is midnight: yesterday through tomorrow. Ranges are asked for in
// local dates + an offset, and offset 0 keeps the boundaries in UTC so the
// window doesn't depend on where the test machine thinks it is.
export function surroundingRange(): { from: string; to: string } {
  const day = (offset: number) => new Date(Date.now() + offset * MS_PER_DAY).toISOString().slice(0, 10);
  return { from: day(-1), to: day(1) };
}

export function fetchSalesReport(token: string, topLimit = 50): Promise<ApiResult<SalesReport>> {
  const { from, to } = surroundingRange();
  return apiRequest<SalesReport>(`/api/reports/sales?from=${from}&to=${to}&tzOffset=0&topLimit=${topLimit}`, {
    token,
  });
}

export function fetchSalesSummary(token: string): Promise<ApiResult<SalesSummary>> {
  return apiRequest<SalesSummary>("/api/reports/sales-summary?tzOffset=0", { token });
}

export async function salesReport(token: string, topLimit = 50): Promise<SalesReport> {
  const res = await fetchSalesReport(token, topLimit);
  if (res.status !== 200 || !res.data) throw new Error(`Could not read the sales report (HTTP ${res.status}).`);
  return res.data;
}

export async function salesSummary(token: string): Promise<SalesSummary> {
  const res = await fetchSalesSummary(token);
  if (res.status !== 200 || !res.data) throw new Error(`Could not read the sales summary (HTTP ${res.status}).`);
  return res.data;
}

// Money crosses the API as 2dp strings (never floats), so tests turn them
// into numbers only here, at the assertion boundary.
export function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export interface TotalsDelta {
  orderCount: number;
  itemCount: number;
  revenue: number;
  discountAmount: number;
  cost: number;
  profit: number;
}

export function totalsDelta(after: SalesTotals, before: SalesTotals): TotalsDelta {
  return {
    orderCount: after.orderCount - before.orderCount,
    itemCount: after.itemCount - before.itemCount,
    revenue: num(after.revenue) - num(before.revenue),
    discountAmount: num(after.discountAmount) - num(before.discountAmount),
    cost: num(after.cost) - num(before.cost),
    profit: num(after.profit) - num(before.profit),
  };
}

export function channelTotals(report: SalesReport, channel: string): SalesTotals {
  const found = report.byChannel.find((entry) => entry.channel === channel);
  if (!found) throw new Error(`The report is missing the ${channel} channel.`);
  return found;
}
