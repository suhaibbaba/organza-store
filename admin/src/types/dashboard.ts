import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { DashboardSummary } from "@store/shared/types/dashboard";
import type { CurrentCashSession } from "@store/shared/types/cash";
import type { DailySales, PeriodSummary, SalesSummary } from "@/types/report";

export type { DashboardSummary };

// `warning` is money someone else holds and must never read as takings.
export type FigureTone = "default" | "positive" | "warning";

// counting withholds the expected figure; reveal shows the difference, which must be explained; done is closed.
export type CloseDayStep = "counting" | "reveal" | "done";

export interface CountComparison {
  expected: string;
  counted: string;
  difference: string;
}

export type DashboardTodoKey =
  "approvals" | "incomplete" | "labels" | "lowStock" | "uncollected" | "customersOwing" | "keptPieces" | "followUps";

export interface DashboardTodoMeta {
  icon: LucideIcon;
  href: string | null;
}

export interface DashboardTodoRow {
  key: DashboardTodoKey;
  value: ReactNode;
  // Zero is nothing to act on, so the row reads muted.
  active: boolean;
}

export interface DashboardHeroProps {
  name: string;
  today: PeriodSummary;
  drawer: CurrentCashSession | undefined;
}

export interface DashboardTodayStripProps {
  today: PeriodSummary;
}

export interface DashboardSalesBarsProps {
  daily: DailySales;
}

export interface DashboardPeriodBriefProps {
  summary: SalesSummary;
}

export interface DashboardTodoListProps {
  summary: DashboardSummary;
  drawer: CurrentCashSession | undefined;
}
