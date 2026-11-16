// What the suite creates and therefore has to take away again
// (tests/support/fixtureRegistry.ts + tests/support/cleanup.ts).
//
// Cash sessions are deliberately absent: a drawer is one per calendar day
// and the API has no way to delete one, which is why the suite only ever
// opens them on synthetic far-future dates that no trading day can reach.

export const FIXTURE_KINDS = ["changeRequest", "order", "expense", "product"] as const;

export type FixtureKind = (typeof FIXTURE_KINDS)[number];

export interface FixtureRecord {
  kind: FixtureKind;
  id: string;
}

export interface CleanupOutcome {
  removed: number;
  /** Fixtures that were already gone — deleted by the test itself, usually. */
  skipped: number;
  failures: { kind: FixtureKind; id: string; reason: string }[];
}
