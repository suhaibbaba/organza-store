import type { REPORT_PERIODS } from "@/constants/report";
import type { I18n } from "@/types/common";
import type { OrderChannel } from "@/types/order";

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

// Money is a 2dp string; every figure comes from order-item snapshots, net of returns, cancelled/deleted orders out.
export interface SalesTotals {
  // Orders with something still sold in them; a fully returned order is not counted.
  orderCount: number;
  itemCount: number;
  // Sold after both discount levels and returns: the sales figure, NOT money in hand.
  revenue: string;
  collectedRevenue: string;
  // Always revenue - collectedRevenue, stated so nobody has to subtract.
  pendingCollectionAmount: string;
  pendingCollectionOrderCount: number;
  discountAmount: string;
  averageOrderValue: string;

  // Admin only (rule 19), absent rather than zeroed; `profit` is GROSS, net lives on the report's `profit` block.
  cost?: string;
  profit?: string;
  // profit / revenue * 100; null with no revenue, since a number would be a divide-by-zero lie.
  margin?: string | null;
  // Lines sold with no cost recorded: they count as 0, so profit is optimistic while this is above zero.
  missingCostItems?: number;
}

// Kept apart from the totals, which are already net of it, so "sold 40 and 3 came back" is answerable.
export interface ReturnsTotals {
  orderCount: number;
  itemCount: number;
  amount: string;
}

export interface ChannelSales extends SalesTotals {
  channel: OrderChannel;
}

// A variant when the product has them, else the product; names are the sale-time snapshots.
export interface TopSeller {
  productId: string | null;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  // The variant's own photo, else the product's; null for a quick-sold or removed piece.
  thumbnailUrl: string | null;
  quantity: number;
  revenue: string;
  profit?: string;
}

// Admin only: sold = received + owed; gross = sold - COGS; net = gross - expenses - gifts at cost (gifts never count as sales).
export interface ProfitTotals {
  sold: string;
  received: string;
  owed: string;
  owedOrderCount: number;

  cogs: string;
  receivedCogs: string;
  // Approved expenses dated in the range, cash or not.
  expenses: string;
  giftCost: string;
  // expenses + giftCost, stated so no screen does money arithmetic of its own.
  overheads: string;

  grossProfit: string;
  netProfit: string;
  receivedGrossProfit: string;
  // Expenses come off in full here too: a bill is owed whether or not the courier has paid.
  receivedNetProfit: string;

  // NET margin (netProfit / sold * 100); null when nothing sold, since 0% would read as a loss.
  netMargin: string | null;

  missingCostItems: number;
}

// `profit` is absent for roles without cost, so a screen renders what arrived rather than deciding a role itself.
export interface PeriodSummary {
  totals: SalesTotals;
  profit?: ProfitTotals;
}

// GET /api/reports/sales-summary: today / this week / this month, all in one request for the dashboard.
export type SalesSummary = Record<ReportPeriod, PeriodSummary>;

// GET /api/reports/sales?from=&to= — the Reports page.
export interface SalesReport {
  // The instants covered, resolved from local dates + offset; `to` is exclusive.
  range: { from: string; to: string };
  totals: SalesTotals;
  profit?: ProfitTotals;
  returns: ReturnsTotals;
  byChannel: ChannelSales[];
  topByRevenue: TopSeller[];
  topByQuantity: TopSeller[];
}
