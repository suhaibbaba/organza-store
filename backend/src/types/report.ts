import type { Prisma } from "@prisma/client";
import type {
  ChannelSales,
  ProfitTotals,
  ReportGranularity,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSeriesPoint,
  SalesSummary,
  SalesTotals,
  TopSeller,
} from "@shared/types/report";

export type {
  ChannelSales,
  ProfitTotals,
  ReportGranularity,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSeriesPoint,
  SalesSummary,
  SalesTotals,
  TopSeller,
};

// The window a report covers, as instants. `to` is exclusive: a range picked
// as 1–3 August ends at local midnight opening the 4th, so a sale rung up at
// 23:59 on the 3rd is inside it.
export interface ReportRange {
  from: Date;
  to: Date;
}

// --- shapes returned by the raw aggregate queries (lib/reports.ts) ---
// Postgres hands back numeric as Prisma.Decimal and count as BigInt; the
// serializers in lib/reports.ts are the only place that converts them.

export interface SalesAggregateRow {
  orderCount: bigint;
  itemCount: Prisma.Decimal | null;
  revenue: Prisma.Decimal | null;
  collectedRevenue: Prisma.Decimal | null;
  pendingCollectionAmount: Prisma.Decimal | null;
  pendingCollectionOrderCount: bigint;
  grossRevenue: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
  // COGS on the part that has actually been paid for — what makes a
  // "received only" profit answerable at all.
  collectedCost: Prisma.Decimal | null;
  missingCostItems: bigint;
  returnedOrderCount: bigint;
  returnedItemCount: Prisma.Decimal | null;
  returnedAmount: Prisma.Decimal | null;
}

export interface ChannelAggregateRow extends SalesAggregateRow {
  channel: string;
}

// What the stock given away in a range cost the shop. Its own query because
// gifts are excluded from the sales view entirely — they earn nothing, so
// letting them anywhere near revenue would be the bug this separation exists
// to prevent.
export interface GiftAggregateRow {
  orderCount: bigint;
  itemCount: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
}

export interface SeriesAggregateRow {
  bucket: string;
  orderCount: bigint;
  revenue: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
}

export interface TopSellerRow {
  productId: string | null;
  variantId: string | null;
  name: unknown;
  variantName: unknown;
  sku: string | null;
  quantity: Prisma.Decimal | null;
  revenue: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
}
