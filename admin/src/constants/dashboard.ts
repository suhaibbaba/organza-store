import type { ReportPeriod } from "@/types/report";

import { Barcode, ClipboardCheck, PackageSearch, Scale, Truck, WandSparkles } from "lucide-react";
import type { DashboardTodoKey, DashboardTodoMeta } from "@/types/dashboard";

export const CASH_SESSION_CURRENT_QUERY_KEY = ["cashSessions", "current"] as const;
export const EXPENSES_PENDING_COUNT_QUERY_KEY = ["expenses", "pendingCount"] as const;

// The drawer goes stale as fast as the sales figures (REPORTS_STALE_TIME_MS).
export const CASH_SESSION_STALE_TIME_MS = 60 * 1000;
export const NEEDS_ATTENTION_STALE_TIME_MS = 60 * 1000;

// The week is what the shop plans around; the month is one tap away.
export const DEFAULT_DASHBOARD_PERIOD: ReportPeriod = "week";

// The brief only switches between these two; today has its own strip above.
export const DASHBOARD_BRIEF_PERIODS: readonly ReportPeriod[] = ["week", "month"];

export const DASHBOARD_RECENT_ORDERS = 5;

// Hours that start the afternoon and the evening greeting.
export const GREETING_AFTERNOON_HOUR = 12;
export const GREETING_EVENING_HOUR = 18;

// Stagger between cards rising in, and between the sales bars growing.
export const DASHBOARD_RISE_STEP_MS = 70;
export const DASHBOARD_BAR_STEP_MS = 60;

// Each to-do row: its icon and the screen that clears it (none when no screen exists yet).
export const DASHBOARD_TODOS: Record<DashboardTodoKey, DashboardTodoMeta> = {
  approvals: { icon: ClipboardCheck, href: "/change-requests" },
  incomplete: { icon: WandSparkles, href: "/products?completeness=needs_completing" },
  labels: { icon: Barcode, href: "/labels" },
  lowStock: { icon: PackageSearch, href: "/inventory?lowStock=true" },
  uncollected: { icon: Truck, href: "/orders/collection" },
  followUps: { icon: Scale, href: null },
};

// CSV, not .xlsx: Excel opens it natively and it needs no library.
export const EXPORT_FILE_PREFIX = "store";
// Without a BOM Excel reads Arabic and Hebrew as mojibake.
export const CSV_BOM = "﻿";
