import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import {
  BACKUP_RUN_HISTORY_LIMIT,
  BACKUP_RUN_STATUS,
  BACKUP_STALE_AFTER_HOURS,
  BACKUP_STALE_CHECK_INTERVAL_HOURS,
  BACKUP_STALE_REPORT_EVERY_HOURS,
} from "@/constants";
import type { BackupRunStatus, BackupStage } from "@/constants/backup";
import { MS_PER_HOUR } from "@organza/shared/constants/time";

/*
 * The API's half of the off-site backup: remembering that it ran.
 *
 * ops/backup.sh does the work and reports its own failures loudly — to the
 * cron log, and to Sentry through `npm run backup:record` below. What that
 * cannot cover is the failure mode this file exists for: a schedule that
 * stopped firing. A cron entry lost in a server move raises no error, fills
 * no log and pages nobody, and the shop finds out on the morning it needs a
 * dump. So the last success is recorded here, served by /health, and its age
 * re-checked on a timer.
 */

export interface RecordBackupRunInput {
  status: BackupRunStatus;
  startedAt: Date;
  destination?: string | null;
  databaseBytes?: number | null;
  imageCount?: number | null;
  imageBytes?: number | null;
  failedStage?: BackupStage | null;
  error?: string | null;
}

/**
 * Write one run to the noticeboard and trim it back to its limit.
 *
 * Both halves in one transaction so a crash between them cannot leave the
 * table growing forever, and the trim is by row rather than by age: "the last
 * ninety" stays bounded whether the schedule is nightly or hourly.
 */
export async function recordBackupRun(input: RecordBackupRunInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.backupRun.create({
      data: {
        status: input.status,
        startedAt: input.startedAt,
        destination: input.destination ?? null,
        databaseBytes: input.databaseBytes == null ? null : BigInt(input.databaseBytes),
        imageCount: input.imageCount ?? null,
        imageBytes: input.imageBytes == null ? null : BigInt(input.imageBytes),
        failedStage: input.failedStage ?? null,
        error: input.error ?? null,
      },
    });

    const survivor = await tx.backupRun.findMany({
      select: { finishedAt: true },
      orderBy: { finishedAt: "desc" },
      skip: BACKUP_RUN_HISTORY_LIMIT - 1,
      take: 1,
    });
    if (survivor.length > 0) {
      await tx.backupRun.deleteMany({ where: { finishedAt: { lt: survivor[0].finishedAt } } });
    }
  });
}

export interface BackupHealth {
  /** When the backup last actually worked. Null means: never, here. */
  lastSuccessAt: Date | null;
  /** Whether that is longer ago than the shop should tolerate. */
  stale: boolean;
  /** Hours since the last success, rounded. Null when there has never been one. */
  ageHours: number | null;
  /** Set when the most recent run FAILED — a success after it clears this. */
  lastFailure: { at: Date; stage: string | null; error: string | null } | null;
}

/**
 * The two questions worth asking: when did it last work, and is the most
 * recent thing that happened a failure. Answered in one round trip each and
 * nothing more — this is read by /health, which is on the path of every
 * uptime check the shop points at the API.
 */
export async function getBackupHealth(now: Date = new Date()): Promise<BackupHealth> {
  const [lastSuccess, latest] = await Promise.all([
    prisma.backupRun.findFirst({
      where: { status: BACKUP_RUN_STATUS.succeeded },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.backupRun.findFirst({
      orderBy: { finishedAt: "desc" },
      select: { status: true, finishedAt: true, failedStage: true, error: true },
    }),
  ]);

  const lastSuccessAt = lastSuccess?.finishedAt ?? null;
  const ageMs = lastSuccessAt ? now.getTime() - lastSuccessAt.getTime() : null;

  return {
    lastSuccessAt,
    // Never having succeeded counts as stale. A deployment that has never
    // been backed up is the state this whole mechanism is here to make
    // visible, and reporting it as healthy because the table is empty would
    // be the one lie that matters.
    stale: ageMs === null || ageMs > BACKUP_STALE_AFTER_HOURS * MS_PER_HOUR,
    ageHours: ageMs === null ? null : Math.round(ageMs / MS_PER_HOUR),
    lastFailure:
      latest && latest.status === BACKUP_RUN_STATUS.failed
        ? { at: latest.finishedAt, stage: latest.failedStage, error: latest.error }
        : null,
  };
}

/**
 * The watcher.
 *
 * A failing backup reports itself; a backup that stopped being run reports
 * nothing, because nothing runs. So the API asks instead — on a timer, from
 * the one process that is always up — and files the answer through the same
 * error-tracking layer as everything else (CLAUDE.md rule 20).
 *
 * Throttled hard on purpose. Once a backup has been stale for a month the
 * information is unchanged every six hours, and an alert that repeats that
 * often is one people mute, which would cost more than it buys.
 */
let lastStaleReportAt: number | null = null;

export async function reportBackupStaleness(now: Date = new Date()): Promise<BackupHealth | null> {
  let health: BackupHealth;
  try {
    health = await getBackupHealth(now);
  } catch (error) {
    // The database being unreachable is somebody else's alarm — every request
    // is already failing. Never let the watcher be the thing that crashes the
    // API it is watching over.
    captureException(error, { check: "backup-staleness" });
    return null;
  }

  if (!health.stale) {
    // Recovered: the next stale spell should be reported at once rather than
    // waiting out a throttle window left over from the last one.
    lastStaleReportAt = null;
    return health;
  }

  const throttleMs = BACKUP_STALE_REPORT_EVERY_HOURS * MS_PER_HOUR;
  if (lastStaleReportAt !== null && now.getTime() - lastStaleReportAt < throttleMs) return health;
  lastStaleReportAt = now.getTime();

  const age = health.lastSuccessAt
    ? `${health.ageHours} hour(s) ago (${health.lastSuccessAt.toISOString()})`
    : "never — there is no successful backup on record for this deployment";

  captureException(new Error(`Off-site backup is stale: last success ${age}`), {
    check: "backup-staleness",
    lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null,
    staleAfterHours: BACKUP_STALE_AFTER_HOURS,
    lastFailure: health.lastFailure,
    hint:
      "ops/backup.sh has not reported a successful run. Check the cron entry on the VPS and " +
      "the R2 credentials in the stack's env file — see ops/README.md.",
  });

  return health;
}

/**
 * Start the watcher. Called once, from the listen callback.
 *
 * `unref()` so this timer can never hold the process open — a container told
 * to stop should stop, not wait six hours for a backup check it does not owe
 * anybody.
 */
export function startBackupStalenessWatch(): NodeJS.Timeout {
  void reportBackupStaleness();
  const timer = setInterval(() => {
    void reportBackupStaleness();
  }, BACKUP_STALE_CHECK_INTERVAL_HOURS * MS_PER_HOUR);
  timer.unref();
  return timer;
}
