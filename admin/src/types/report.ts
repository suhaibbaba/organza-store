import type {
  ChannelSales,
  PeriodSummary,
  ProfitTotals,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSummary,
  SalesTotals,
  TopSeller,
} from "@organza/shared/types/report";

export type {
  ChannelSales,
  PeriodSummary,
  ProfitTotals,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSummary,
  SalesTotals,
  TopSeller,
};

// The quick ranges offered by the picker, plus the escape hatch to two dates.
export type ReportPresetKey = "today" | "last7Days" | "last30Days" | "thisMonth" | "custom";

export type TopSellerRanking = "revenue" | "quantity";

// Local calendar dates (YYYY-MM-DD); the backend resolves them with the viewer's timezone offset.
export interface ReportRangeValue {
  preset: ReportPresetKey;
  from: string;
  to: string;
}
