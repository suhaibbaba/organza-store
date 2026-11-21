// Live API: every test snapshots the report, sells, and asserts the difference.
import { apiRequest } from "@tests/support/client";
import { MS_PER_DAY } from "@/constants";
import type { ApiResult, SalesReport, SalesSummary, SalesTotals } from "@tests/types";

// Yesterday to tomorrow in UTC, so the window holds the run even at midnight wherever the machine is.
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
  if (res.status !== 200 || !res.data) {
    throw new Error(`Could not read the sales report (HTTP ${res.status}).`);
  }
  return res.data;
}

export async function salesSummary(token: string): Promise<SalesSummary> {
  const res = await fetchSalesSummary(token);
  if (res.status !== 200 || !res.data) {
    throw new Error(`Could not read the sales summary (HTTP ${res.status}).`);
  }
  return res.data;
}

// Money crosses the API as 2dp strings; they become numbers only here.
export function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export interface TotalsDelta {
  orderCount: number;
  itemCount: number;
  revenue: number;
  // What was sold vs what has been paid: they diverge once an order goes out with the courier.
  collectedRevenue: number;
  pendingCollectionAmount: number;
  pendingCollectionOrderCount: number;
  discountAmount: number;
  cost: number;
  profit: number;
}

export function totalsDelta(after: SalesTotals, before: SalesTotals): TotalsDelta {
  return {
    orderCount: after.orderCount - before.orderCount,
    itemCount: after.itemCount - before.itemCount,
    revenue: num(after.revenue) - num(before.revenue),
    collectedRevenue: num(after.collectedRevenue) - num(before.collectedRevenue),
    pendingCollectionAmount: num(after.pendingCollectionAmount) - num(before.pendingCollectionAmount),
    pendingCollectionOrderCount: after.pendingCollectionOrderCount - before.pendingCollectionOrderCount,
    discountAmount: num(after.discountAmount) - num(before.discountAmount),
    cost: num(after.cost) - num(before.cost),
    profit: num(after.profit) - num(before.profit),
  };
}

export function channelTotals(report: SalesReport, channel: string): SalesTotals {
  const found = report.byChannel.find((entry) => entry.channel === channel);
  if (!found) {
    throw new Error(`The report is missing the ${channel} channel.`);
  }
  return found;
}
