import { urlParam } from "@/lib/url-filters";
import type { ReportPresetKey, ReportRangeValue, TopSellerRanking } from "@/types/report";
import type { UrlParams } from "@/types/urlFilters";

export const REPORTS_SUMMARY_QUERY_KEY = ["reports", "salesSummary"] as const;
export const REPORTS_DAILY_QUERY_KEY = ["reports", "dailySales"] as const;
export const REPORTS_SALES_QUERY_KEY = "reports.sales";

// Sales go stale fast; a minute spares a refetch per navigation without showing yesterday's number.
export const REPORTS_STALE_TIME_MS = 60 * 1000;

// "This month" is the default: it's the figure the rent is paid out of.
export const REPORT_PRESETS: readonly ReportPresetKey[] = [
  "today",
  "thisWeek",
  "last7Days",
  "last30Days",
  "thisMonth",
  "custom",
];
export const DEFAULT_REPORT_PRESET: ReportPresetKey = "thisMonth";

export const REPORT_PRESET_DAYS: Partial<Record<ReportPresetKey, number>> = {
  today: 0,
  last2Days: 1,
  last7Days: 6,
  last30Days: 29,
};

// Five fills a phone screen without scrolling past where anyone still reads.
export const TOP_SELLERS_LIMIT = 5;

export const TOP_SELLER_RANKINGS: readonly { value: TopSellerRanking; labelKey: "byRevenue" | "byQuantity" }[] = [
  { value: "revenue", labelKey: "byRevenue" },
  { value: "quantity", labelKey: "byQuantity" },
];

// Dates only travel in the URL for a custom range; a preset is worked out from today on every visit.
export const DEFAULT_REPORT_RANGE: ReportRangeValue = { preset: DEFAULT_REPORT_PRESET, from: "", to: "" };

export const REPORT_RANGE_URL_PARAMS: UrlParams<ReportRangeValue> = {
  preset: urlParam.oneOf(REPORT_PRESETS),
  from: urlParam.text(),
  to: urlParam.text(),
};

export const REPORT_THUMB_SIZES = "(max-width: 767px) 64px, 48px";
