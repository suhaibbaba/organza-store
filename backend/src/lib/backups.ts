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
import { MS_PER_HOUR } from "@store/shared/constants/time";

// Records each off-site backup run, so the API can notice a schedule that silently stopped firing.

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

/** Writes one run and trims to the row limit in one transaction, so the table stays bounded. */
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

/** When did it last work, and is the latest run a failure — one query each, since /health reads this. */
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
    // Never having succeeded counts as stale — an empty table must never read as healthy.
    stale: ageMs === null || ageMs > BACKUP_STALE_AFTER_HOURS * MS_PER_HOUR,
    ageHours: ageMs === null ? null : Math.round(ageMs / MS_PER_HOUR),
    lastFailure:
      latest && latest.status === BACKUP_RUN_STATUS.failed
        ? { at: latest.finishedAt, stage: latest.failedStage, error: latest.error }
        : null,
  };
}

/** The watcher: a backup that stopped running reports nothing, so the API checks on a timer (throttled, rule 20). */
let lastStaleReportAt: number | null = null;

export async function reportBackupStaleness(now: Date = new Date()): Promise<BackupHealth | null> {
  let health: BackupHealth;
  try {
    health = await getBackupHealth(now);
  } catch (error) {
    // An unreachable database is someone else's alarm; the watcher must never crash the API.
    captureException(error, { check: "backup-staleness" });
    return null;
  }

  if (!health.stale) {
    // Recovered: report the next stale spell at once, not after a leftover throttle window.
    lastStaleReportAt = null;
    return health;
  }

  const throttleMs = BACKUP_STALE_REPORT_EVERY_HOURS * MS_PER_HOUR;
  if (lastStaleReportAt !== null && now.getTime() - lastStaleReportAt < throttleMs) {
    return health;
  }
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

/** Started once from the listen callback; unref() so the timer never holds the process open. */
export function startBackupStalenessWatch(): NodeJS.Timeout {
  void reportBackupStaleness();
  const timer = setInterval(() => {
    void reportBackupStaleness();
  }, BACKUP_STALE_CHECK_INTERVAL_HOURS * MS_PER_HOUR);
  timer.unref();
  return timer;
}
