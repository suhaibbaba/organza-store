import { Prisma } from "@prisma/client";
import type { AnyRecord } from "@/types";

// The one definition of "sold, and still waiting for somebody to finish it"
// (spec.md "Quick sell"), in both the shapes the app needs it: as a predicate
// over a loaded row, and as SQL for the list query.
//
// Kept together and beside each other for the same reason needsLabel and
// NEEDS_LABEL_WHERE are: a queue filtered one way and counted another would
// report totals that include pieces the screen then drops (CLAUDE.md rule 15).
//
// Three stamps, no status column (rule 21): quick-sold, and neither completed
// nor ruled a one-off.

export function needsCompleting(product: AnyRecord): boolean {
  return Boolean(product.quickSoldAt) && !product.completedAt && !product.oneOffAt;
}

export const NEEDS_COMPLETING_WHERE: Prisma.ProductWhereInput = {
  quickSoldAt: { not: null },
  completedAt: null,
  oneOffAt: null,
};

/** Everything that was ever quick-sold, decided or not — the season's record. */
export const QUICK_SOLD_WHERE: Prisma.ProductWhereInput = { quickSoldAt: { not: null } };
