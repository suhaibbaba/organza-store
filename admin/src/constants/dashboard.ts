import type { ReportPeriod } from "@/types/report";

// The dashboard (spec.md "Cash drawer & expenses" -> Reporting). Four
// sections, always in this order: Today, the cash drawer, a period, and what
// needs attention. Deliberately figures only — no chart. The people using
// this read it standing at a counter on a phone, and a number they can act on
// beats a trend they have to interpret.

export const CASH_SESSION_CURRENT_QUERY_KEY = ["cashSessions", "current"] as const;
export const EXPENSES_PENDING_COUNT_QUERY_KEY = ["expenses", "pendingCount"] as const;

// The drawer moves with every sale rung up at the till, so it goes stale as
// fast as the sales figures do (REPORTS_STALE_TIME_MS).
export const CASH_SESSION_STALE_TIME_MS = 60 * 1000;
export const NEEDS_ATTENTION_STALE_TIME_MS = 60 * 1000;

// Which period the figures block opens on. The month is what rent is paid
// out of, and it is the figure the owner checks when they open the app.
export const DEFAULT_DASHBOARD_PERIOD: ReportPeriod = "month";

// The export is a spreadsheet the shop opens in Excel. CSV rather than a
// real .xlsx: Excel opens it natively, it needs no library (the deployment
// rules keep dependencies down), and it survives being mailed on.
export const EXPORT_FILE_PREFIX = "organza";
// Excel only reads a UTF-8 CSV as UTF-8 when it starts with a byte-order
// mark — without it, Arabic and Hebrew arrive as mojibake.
export const CSV_BOM = "﻿";
