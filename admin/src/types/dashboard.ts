import type { DashboardSummary } from "@organza/shared/types/dashboard";

export type { DashboardSummary };

// How a figure is coloured. `warning` is money someone else is holding —
// it must never read as takings; `positive` is money the shop has.
export type FigureTone = "default" | "positive" | "warning";

// Where the blind count has got to (see close-day-sheet.tsx).
//
//   counting — the expected figure is deliberately withheld while the drawer
//              is counted, so nobody can make the count agree with the books;
//   reveal   — the count disagreed: expected vs counted vs difference are now
//              on screen, and the difference has to be explained before it
//              can be saved;
//   done     — closed, with the comparison shown.
export type CloseDayStep = "counting" | "reveal" | "done";

// What the server said when it refused an unexplained difference, and what
// it says once the day is closed. Money as 2dp strings, like everywhere else.
export interface CountComparison {
  expected: string;
  counted: string;
  difference: string;
}
