import type { ReportPresetKey, TopSellerRanking } from "@/types/report";

export const REPORTS_SUMMARY_QUERY_KEY = ["reports", "salesSummary"] as const;
export const REPORTS_SALES_QUERY_KEY = "reports.sales";

// Sales go stale fast; a minute spares a refetch per navigation without showing yesterday's number.
export const REPORTS_STALE_TIME_MS = 60 * 1000;

// "This month" is the default: it's the figure the rent is paid out of.
export const REPORT_PRESETS: readonly ReportPresetKey[] = [
  "today",
  "last7Days",
  "last30Days",
  "thisMonth",
  "custom",
];
export const DEFAULT_REPORT_PRESET: ReportPresetKey = "thisMonth";

export const REPORT_PRESET_DAYS: Partial<Record<ReportPresetKey, number>> = {
  today: 0,
  last7Days: 6,
  last30Days: 29,
};

// Five fills a phone screen without scrolling past where anyone still reads.
export const TOP_SELLERS_LIMIT = 5;

export const TOP_SELLER_RANKING_TABS: readonly { id: TopSellerRanking; label: string }[] = [
  { id: "revenue", label: "reports.topSellers.byRevenue" },
  { id: "quantity", label: "reports.topSellers.byQuantity" },
];
