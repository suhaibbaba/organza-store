import type { ReportPresetKey } from "@/types/report";

export const REPORTS_SUMMARY_QUERY_KEY = ["reports", "salesSummary"] as const;
export const REPORTS_SALES_QUERY_KEY = "reports.sales";

// Sales figures move with every sale rung up at the counter, so they go stale
// fast — a minute is long enough to spare the API a refetch per navigation
// and short enough that the dashboard isn't showing yesterday's number.
export const REPORTS_STALE_TIME_MS = 60 * 1000;

// The ranges a shop owner actually asks for, in the order they'd ask. "This
// month" is the default: it's the figure the rent is paid out of.
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

// How many best sellers to ask for. Five fills a phone screen without
// scrolling past the point where anyone is still reading.
export const TOP_SELLERS_LIMIT = 5;
