import type {
  ChannelSales,
  PeriodSummary,
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
  PeriodSummary,
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

// The quick ranges offered by the picker, plus the escape hatch to two dates.
export type ReportPresetKey = "today" | "last7Days" | "last30Days" | "thisMonth" | "custom";

// What the Reports page asks the API for: two local calendar dates
// (YYYY-MM-DD) — the backend resolves them into instants using the viewer's
// timezone offset, which the API layer attaches.
export interface ReportRangeValue {
  preset: ReportPresetKey;
  from: string;
  to: string;
}
