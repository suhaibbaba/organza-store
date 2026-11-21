// Shared so the backend computes and the admin renders against one set of periods and limits.

// The three quick periods on the dashboard's Sales & Profit block.
export const REPORT_PERIODS = ["today", "week", "month"] as const;

// The shop's week starts on Saturday (JS getDay(): 0 = Sunday … 6 = Saturday).
export const REPORT_WEEK_START_DAY = 6;

// Minutes to ADD to UTC for the viewer's local time; the bounds cover every real zone.
export const REPORT_TZ_OFFSET_MIN_MINUTES = -840;
export const REPORT_TZ_OFFSET_MAX_MINUTES = 840;

// A picked range is plain local dates; the backend turns them into instants with the offset.
export const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A year and a day, so "the last 12 months" always fits.
export const MAX_REPORT_RANGE_DAYS = 366;

// Best sellers are a bounded top N, not a browsable list.
export const DEFAULT_TOP_SELLERS_LIMIT = 5;
export const MAX_TOP_SELLERS_LIMIT = 50;

// Margin percentage kept to money's 2 places, so the API never emits a repeating decimal.
export const MARGIN_DECIMAL_PLACES = 2;

// The dashboard's sales bars: today and the six days before it.
export const DASHBOARD_DAILY_SALES_DAYS = 7;
