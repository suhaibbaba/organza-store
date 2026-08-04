// Sales & profit reporting (spec.md "Reports", Phase 2). Everything here is
// shared so the backend computes and the admin renders against one set of
// rules — periods, limits and bucket sizes are never re-invented per app.

// The three quick periods on the dashboard's Sales & Profit block.
export const REPORT_PERIODS = ["today", "week", "month"] as const;

// The store is in Palestine, where the week starts on Saturday — so "this
// week" on the dashboard means "since Saturday", not since Monday.
// 0 = Sunday … 6 = Saturday (JS getDay()).
export const REPORT_WEEK_START_DAY = 6;

// A report is always read in the viewer's own local time: "today" on a phone
// in Tulkarm must not mean "today in UTC". The client sends its offset in
// minutes to ADD to UTC (i.e. -new Date().getTimezoneOffset()); the bounds
// below cover every real zone (UTC-14 … UTC+14).
export const REPORT_TZ_OFFSET_MIN_MINUTES = -840;
export const REPORT_TZ_OFFSET_MAX_MINUTES = 840;

// Ranges are chosen with a date picker, so a plain YYYY-MM-DD local date is
// the whole input — the backend turns it into instants using the offset above.
export const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A year and a day, so "the last 12 months" always fits.
export const MAX_REPORT_RANGE_DAYS = 366;

// Chart buckets: a phone can read ~two months of daily bars, but not a year
// of them. The backend picks the granularity from the range length and says
// which one it used, so the chart never has to guess.
export const REPORT_GRANULARITIES = ["day", "week", "month"] as const;
export const REPORT_DAILY_MAX_DAYS = 62;
export const REPORT_WEEKLY_MAX_DAYS = 180;

// Best sellers are a bounded "top N", not a browsable list — the full
// per-product breakdown is what the products/orders lists are for.
export const DEFAULT_TOP_SELLERS_LIMIT = 5;
export const MAX_TOP_SELLERS_LIMIT = 50;

// Margin is a percentage (profit / revenue * 100), kept to the same 2 places
// as money so the API never emits a repeating decimal.
export const MARGIN_DECIMAL_PLACES = 2;
