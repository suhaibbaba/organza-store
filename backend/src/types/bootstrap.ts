/** What one bootstrap run did, by marker key — printed by the CLI so a deploy log says exactly what changed. */
export interface BootstrapSummary {
  /** Rows this run inserted. */
  created: string[];
  /** Rows that already existed (from the old dev seed, or a half-finished run) and were simply recorded. */
  adopted: string[];
  /** Items bootstrapped by an earlier run — deliberately untouched, deleted or not. */
  skipped: string[];
}
