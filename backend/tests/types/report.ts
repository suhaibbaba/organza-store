// The report endpoints return the shared DTOs verbatim (unlike the order
// serializers, which build plain objects — see tests/types/order.ts), so the
// suite asserts against the very types the API is typed with.
export type {
  ChannelSales,
  ReportGranularity,
  ReportPeriod,
  ReturnsTotals,
  SalesReport,
  SalesSeriesPoint,
  SalesSummary,
  SalesTotals,
  TopSeller,
} from "@shared/types/report";
