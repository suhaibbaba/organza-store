import type { REPORT_GRANULARITIES, REPORT_PERIODS } from "@/constants/report";
import type { I18n } from "@/types/common";
import type { OrderChannel } from "@/types/order";

export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];

// Every money figure below is a 2dp string, like the rest of the API: floats
// can't hold every 2dp value exactly (CLAUDE.md — money is never a Float).
//
// All of it is computed from the ORDER ITEM SNAPSHOTS (unitPrice/unitCost
// frozen at sale time), never from today's catalogue, and always net:
// cancelled and soft-deleted orders are out, returned quantities are
// subtracted from both revenue and cost.
export interface SalesTotals {
  // Orders that still have something sold in them (a fully returned order
  // contributes nothing, so it isn't counted).
  orderCount: number;
  // Units sold, minus units returned.
  itemCount: number;
  // What the shop sold: unit prices less item AND order discounts, less
  // returns. This is the sales figure — NOT the money in hand, because an
  // order handed to the delivery company is only paid for later.
  revenue: string;
  // The part of `revenue` whose money has actually been collected (a counter
  // sale, or a courier order an Admin/Manager has settled).
  collectedRevenue: string;
  // The part still owed by the delivery company. Always
  // revenue - collectedRevenue, stated explicitly so the shop can read what
  // it is waiting for without doing the subtraction.
  pendingCollectionAmount: string;
  // How many orders that outstanding amount is spread over.
  pendingCollectionOrderCount: number;
  // How much was given away in discounts (both levels) on what stayed sold.
  discountAmount: string;
  averageOrderValue: string;

  // SENSITIVE (CLAUDE.md rule 19 — product.viewCost): Admin + Manager only.
  // Absent entirely from an Employee's response, not zeroed.
  cost?: string;
  profit?: string;
  // profit / revenue * 100, as a 2dp string. Null when revenue is 0 (there
  // is no margin on nothing) — a number here would be a divide-by-zero lie.
  margin?: string | null;
  // Sold lines whose product had no cost recorded at the time of sale. They
  // count as cost 0, so a non-zero number here means profit is optimistic —
  // the admin surfaces it rather than letting the figure quietly mislead.
  missingCostItems?: number;
}

// What came back. Kept separate from the totals above (which are already net
// of it) so "we sold 40 and 3 came back" is answerable.
export interface ReturnsTotals {
  orderCount: number;
  itemCount: number;
  amount: string;
}

export interface ChannelSales extends SalesTotals {
  channel: OrderChannel;
}

// One bucket of the trend chart. `date` is the bucket's first local day
// (YYYY-MM-DD) — the granularity says how wide it is.
export interface SalesSeriesPoint {
  date: string;
  orderCount: number;
  revenue: string;
  profit?: string;
}

// One best-selling line: a variant when the product has them, the product
// itself otherwise. Names are the snapshots taken at sale time.
export interface TopSeller {
  productId: string | null;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  quantity: number;
  revenue: string;
  profit?: string;
}

// GET /api/reports/sales-summary — the dashboard's Sales & Profit block.
export type SalesSummary = Record<ReportPeriod, SalesTotals>;

// GET /api/reports/sales?from=&to= — the Reports page.
export interface SalesReport {
  // The instants the figures actually cover, resolved from the requested
  // local dates + offset. `to` is exclusive (local midnight after `to`).
  range: { from: string; to: string };
  granularity: ReportGranularity;
  totals: SalesTotals;
  returns: ReturnsTotals;
  byChannel: ChannelSales[];
  series: SalesSeriesPoint[];
  topByRevenue: TopSeller[];
  topByQuantity: TopSeller[];
}
