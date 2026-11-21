import { REPORT_PERIODS } from "@store/shared/constants/report";
import type { ReportPeriod } from "@/types/report";

// Dashboard: Today, cash drawer, a period, needs attention — figures only, no chart.

export const CASH_SESSION_CURRENT_QUERY_KEY = ["cashSessions", "current"] as const;
export const EXPENSES_PENDING_COUNT_QUERY_KEY = ["expenses", "pendingCount"] as const;

// The drawer goes stale as fast as the sales figures (REPORTS_STALE_TIME_MS).
export const CASH_SESSION_STALE_TIME_MS = 60 * 1000;
export const NEEDS_ATTENTION_STALE_TIME_MS = 60 * 1000;

// The month is what rent is paid out of — the figure the owner checks first.
export const DEFAULT_DASHBOARD_PERIOD: ReportPeriod = "month";

export const DASHBOARD_PERIOD_TABS: readonly { id: ReportPeriod; label: string }[] = REPORT_PERIODS.map(
  (key) => ({ id: key, label: `dashboard.period.periods.${key}` })
);

// CSV, not .xlsx: Excel opens it natively and it needs no library.
export const EXPORT_FILE_PREFIX = "store";
// Without a BOM Excel reads Arabic and Hebrew as mojibake.
export const CSV_BOM = "﻿";
