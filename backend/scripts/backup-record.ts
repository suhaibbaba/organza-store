#!/usr/bin/env tsx
// ============================================================================
//  npm run backup:record — file the outcome of one off-site backup run.
//
//  Called by ops/backup.sh, never by a person and never by the deploy. The
//  script does the backing up; this is what makes the result findable
//  afterwards:
//
//    * a FAILED run goes to Sentry through the usual layer (lib/logger.ts),
//      because a backup that broke at 02:30 has nobody watching the terminal;
//    * either outcome is written to the BackupRun table, which is what
//      /health serves and `npm run backup:status` prints.
//
//  Sentry FIRST, database second, and the database failing does not fail the
//  command. The order is the point: the most likely reason a backup failed at
//  all is that the database was unreachable, and a reporter that needs the
//  database to report "the database is unreachable" reports nothing.
//
//    npm run backup:record -- --status=SUCCEEDED --started-at=<iso> \
//      --database-bytes=1234 --image-count=88 --image-bytes=5678
//    npm run backup:record -- --status=FAILED --stage=upload --error="..."
// ============================================================================
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { recordBackupRun } from "@/lib/backups";
import { BACKUP_ENV, BACKUP_RECORD_FLAGS, BACKUP_RUN_STATUS } from "@/constants";
import type { BackupRunStatus, BackupStage } from "@/constants/backup";

/** `--flag=value` and `--flag value`, so the shell caller can use either. */
function readFlag(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return argv[i + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function readNumberFlag(name: string): number | null {
  const raw = readFlag(name);
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readStatus(): BackupRunStatus {
  const raw = (readFlag(BACKUP_RECORD_FLAGS.status) ?? "").trim().toUpperCase();
  const allowed = Object.values(BACKUP_RUN_STATUS) as string[];
  if (!allowed.includes(raw)) {
    throw new Error(
      `${BACKUP_RECORD_FLAGS.status} must be one of ${allowed.join(", ")} — got ${raw || "(nothing)"}`
    );
  }
  return raw as BackupRunStatus;
}

/**
 * An unknown stage is recorded as-is rather than refused. This runs on the
 * error path of something that has already gone wrong, and throwing the whole
 * report away over a typo in a label is the worse trade — BACKUP_STAGE is the
 * set ops/backup.sh uses, not a constraint on what may be written down.
 */
function readStage(): BackupStage | null {
  const raw = (readFlag(BACKUP_RECORD_FLAGS.stage) ?? "").trim();
  return raw ? (raw as BackupStage) : null;
}

/** Defaults to now, so a caller that never got as far as a start time still records. */
function readStartedAt(): Date {
  const raw = readFlag(BACKUP_RECORD_FLAGS.startedAt);
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function main(): Promise<void> {
  const status = readStatus();
  const startedAt = readStartedAt();
  const stage = readStage();
  const error = readFlag(BACKUP_RECORD_FLAGS.error)?.trim() || null;
  const destination =
    readFlag(BACKUP_RECORD_FLAGS.destination)?.trim() || process.env[BACKUP_ENV.destination] || null;

  const databaseBytes = readNumberFlag(BACKUP_RECORD_FLAGS.databaseBytes);
  const imageCount = readNumberFlag(BACKUP_RECORD_FLAGS.imageCount);
  const imageBytes = readNumberFlag(BACKUP_RECORD_FLAGS.imageBytes);

  // --- loudly, first ------------------------------------------------------
  if (status === BACKUP_RUN_STATUS.failed) {
    captureException(new Error(`Off-site backup FAILED at stage "${stage ?? "unknown"}": ${error ?? "no detail"}`), {
      check: "backup-run",
      stage,
      destination,
      startedAt: startedAt.toISOString(),
      hint: "The shop has no fresh off-site copy. See ops/README.md, 'When a backup fails'.",
    });
  }

  // --- then on the noticeboard --------------------------------------------
  try {
    await recordBackupRun({
      status,
      startedAt,
      destination,
      databaseBytes,
      imageCount,
      imageBytes,
      failedStage: stage,
      error,
    });
    console.log(`Recorded backup run: ${status}${stage ? ` (stage ${stage})` : ""}`);
  } catch (dbError) {
    // Deliberately not fatal. The run itself has already succeeded or failed
    // on its own merits, and turning "we could not write the note about it"
    // into "the backup failed" would send ops/backup.sh chasing the wrong
    // problem — and, on a SUCCEEDED run, throw away a backup that is sitting
    // safely in R2.
    captureException(dbError, {
      check: "backup-run",
      hint: "The backup ran, but its outcome could not be written to the BackupRun table.",
    });
    console.error("Could not record the run in the database (the backup itself is unaffected).");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
