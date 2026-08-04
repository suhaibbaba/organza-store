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

// Chart geometry. Short enough that a chart plus its heading fits above the
// fold on a phone, tall enough to read a trend.
export const CHART_HEIGHT = 200;
export const CHART_BAR_RADIUS = 4;
export const CHART_LINE_WIDTH = 2;
export const CHART_DOT_RADIUS = 4;

// Series colours come from CSS custom properties (globals.css) so light and
// dark mode swap in one place. The order is fixed and meaning-bearing:
// slot 1 is revenue everywhere, slot 2 profit everywhere.
export const CHART_COLORS = {
  revenue: "var(--chart-1)",
  profit: "var(--chart-2)",
  third: "var(--chart-3)",
  grid: "var(--chart-grid)",
} as const;

// One colour per channel, held fixed so STORE is the same colour on every
// screen and filtering never repaints the survivors.
export const CHANNEL_COLORS: Record<string, string> = {
  STORE: CHART_COLORS.revenue,
  WHATSAPP: CHART_COLORS.profit,
  WEBSITE: CHART_COLORS.third,
};
