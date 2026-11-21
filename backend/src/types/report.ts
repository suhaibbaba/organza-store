import type { Prisma } from "@prisma/client";
import type {
  ChannelSales,
  ProfitTotals,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSummary,
  SalesTotals,
  TopSeller,
} from "@store/shared/types/report";

export type {
  ChannelSales,
  ProfitTotals,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSummary,
  SalesTotals,
  TopSeller,
};

// A report window as instants; `to` is exclusive, so 1–3 August ends at local midnight on the 4th.
export interface ReportRange {
  from: Date;
  to: Date;
}

// Raw aggregate rows (Decimal, BigInt), converted only by the serializers in lib/reports.ts.

export interface SalesAggregateRow {
  orderCount: bigint;
  itemCount: Prisma.Decimal | null;
  revenue: Prisma.Decimal | null;
  collectedRevenue: Prisma.Decimal | null;
  pendingCollectionAmount: Prisma.Decimal | null;
  pendingCollectionOrderCount: bigint;
  grossRevenue: Prisma.Decimal | null;
  cost: Prisma.Decimal | null;
  // COGS on the paid-for part — what makes a received-only profit answerable.
  collectedCost: Prisma.Decimal | null;
  missingCostItems: bigint;
  returnedOrderCount: bigint;
  returnedItemCount: Prisma.Decimal | null;
  returnedAmount: Prisma.Decimal | null;
}

export interface ChannelAggregateRow extends SalesAggregateRow {
  channel: string;
}

// Cost of stock given away; its own query, since gifts are kept out of the sales view entirely.
export interface GiftAggregateRow {
  orderCount: bigint;
  itemCount: Prisma.Decimal | null;
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
