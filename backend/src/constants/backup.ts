// The off-site backup (ops/backup.sh) as the API knows it.
//
// The script does the work — pg_dump, the sync to Cloudflare R2, the pruning.
// The API's only part is remembering that it happened, so "the backup stopped
// six weeks ago" is something the shop finds out from /health rather than
// from the morning it needed one. Everything here is a name or a number
// shared between the two.

/** The outcomes a run can end in, as stored in `BackupRun.status`. */
export const BACKUP_RUN_STATUS = {
  succeeded: "SUCCEEDED",
  failed: "FAILED",
} as const;

export type BackupRunStatus = (typeof BACKUP_RUN_STATUS)[keyof typeof BACKUP_RUN_STATUS];

/** Which stage broke, so a failure says more than "the backup failed". */
export const BACKUP_STAGE = {
  dump: "dump",
  upload: "upload",
  images: "images",
  prune: "prune",
} as const;

export type BackupStage = (typeof BACKUP_STAGE)[keyof typeof BACKUP_STAGE];

/**
 * How old the last SUCCESSFUL run may be before the backup counts as stale.
 *
 * The schedule is nightly, so one missed night is 24 hours and could be a
 * slow run, a reboot or a clock. Two is a pattern. Set it much tighter and
 * the warning is noise, which is the failure mode that matters here — a
 * staleness alarm nobody believes is the same as no alarm at all.
 */
export const BACKUP_STALE_AFTER_HOURS = 48;

/**
 * How often the API re-asks whether the backup has gone stale, and how long
 * it waits between saying so.
 *
 * The check is a single indexed row read, so the interval is about how
 * quickly the shop should hear rather than about cost. Reporting is throttled
 * separately: a backup that stopped in March must not file an issue every six
 * hours until somebody looks.
 */
export const BACKUP_STALE_CHECK_INTERVAL_HOURS = 6;
export const BACKUP_STALE_REPORT_EVERY_HOURS = 24;

/** Where `backup:record` takes its values from, when not given as flags. */
export const BACKUP_ENV = {
  /** Set by ops/backup.sh so a recorded run names the bucket it reached. */
  destination: "R2_BUCKET",
} as const;

/** Flags `npm run backup:record` understands. Kept here, not inline. */
export const BACKUP_RECORD_FLAGS = {
  status: "--status",
  stage: "--stage",
  startedAt: "--started-at",
  databaseBytes: "--database-bytes",
  imageCount: "--image-count",
  imageBytes: "--image-bytes",
  destination: "--destination",
  error: "--error",
} as const;

/**
 * How many runs are kept in the table.
 *
 * This is a noticeboard, not an archive — the useful questions are "when did
 * it last work" and "has it been failing for a while", and both are answered
 * by the last few weeks. Trimmed on write so the row count cannot grow
 * without anything ever pruning it.
 */
export const BACKUP_RUN_HISTORY_LIMIT = 90;
