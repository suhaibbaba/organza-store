import type { ReactNode } from "react";
import type {
  ChannelSales,
  DailySales,
  DailySalesDay,
  PeriodSummary,
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
  DailySales,
  DailySalesDay,
  PeriodSummary,
  ProfitTotals,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSummary,
  SalesTotals,
  TopSeller,
};

export type ReportPresetKey = "today" | "last7Days" | "last30Days" | "thisMonth" | "custom";

export type TopSellerRanking = "revenue" | "quantity";

// Local calendar dates (YYYY-MM-DD); the backend resolves them with the viewer's timezone offset.
export interface ReportRangeValue {
  preset: ReportPresetKey;
  from: string;
  to: string;
}

export interface ReportRangePickerProps {
  value: ReportRangeValue;
  onChange: (value: ReportRangeValue) => void;
}

export interface ReportHeadlineProps {
  totals: SalesTotals;
}

export interface ReportProfitStatementProps {
  profit: ProfitTotals;
}

export type StatementSign = "minus" | "equals";

export interface StatementRowProps {
  label: string;
  amount: string;
  sign?: StatementSign;
  emphasis?: "subtotal" | "total";
  name: string;
}

export interface ReportOrdersCardProps {
  totals: SalesTotals;
}

export interface ReportFactRowProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  name: string;
}

export interface ReportChannelsCardProps {
  byChannel: ChannelSales[];
}

export interface ReportTopSellersProps {
  byRevenue: TopSeller[];
  byQuantity: TopSeller[];
}

export interface ReportReturnsCardProps {
  returns: ReturnsTotals;
}

export interface ReportErrorProps {
  error: unknown;
  onRetry: () => void;
}
