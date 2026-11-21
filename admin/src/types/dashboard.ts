import type { DashboardSummary } from "@store/shared/types/dashboard";

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
