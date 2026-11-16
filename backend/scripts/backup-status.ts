#!/usr/bin/env tsx
// ============================================================================
//  npm run backup:status — when did the off-site backup last actually work?
//
//  The question you want answered in ten seconds over SSH, and the one nobody
//  thinks to ask until the morning it matters. Reads the BackupRun table that
//  ops/backup.sh writes to (via `backup:record`), prints the last few runs,
//  and EXITS NON-ZERO when the last success is older than
//  BACKUP_STALE_AFTER_HOURS — so it can be dropped into a monitor or a cron
//  entry without anybody having to parse its output.
//
//    npm run backup:status
//    npm run backup:status -- --json     # for a monitor rather than a person
//
//  Same figures as /health serves; this is the terminal spelling of them.
// ============================================================================
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getBackupHealth } from "@/lib/backups";
import { BACKUP_RUN_STATUS, BACKUP_STALE_AFTER_HOURS, COMMAND_RULE } from "@/constants";

const RULE = COMMAND_RULE;
const RECENT_RUNS = 5;

/** Bytes as something a person reads, not as a number they have to divide. */
function humanBytes(bytes: bigint | null): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function main(): Promise<void> {
  const health = await getBackupHealth();
  const recent = await prisma.backupRun.findMany({
    orderBy: { finishedAt: "desc" },
    take: RECENT_RUNS,
  });

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          lastSuccessAt: health.lastSuccessAt?.toISOString() ?? null,
          ageHours: health.ageHours,
          stale: health.stale,
          staleAfterHours: BACKUP_STALE_AFTER_HOURS,
          lastFailure: health.lastFailure && {
            ...health.lastFailure,
            at: health.lastFailure.at.toISOString(),
          },
        },
        null,
        2
      )
    );
    process.exitCode = health.stale ? 1 : 0;
    return;
  }

  console.log(RULE);
  console.log("  Organza — off-site backup status");
  console.log(RULE);

  if (health.lastSuccessAt) {
    console.log(`  Last success : ${health.lastSuccessAt.toISOString()}  (${health.ageHours}h ago)`);
  } else {
    console.log("  Last success : NEVER — nothing has ever been backed up from this deployment");
  }
  console.log(`  Stale after  : ${BACKUP_STALE_AFTER_HOURS}h`);
  console.log(`  Verdict      : ${health.stale ? "⚠  STALE" : "✔  fresh"}`);

  if (health.lastFailure) {
    console.log("");
    console.log(`  ⚠  The most recent run FAILED at ${health.lastFailure.at.toISOString()}`);
    console.log(`     stage : ${health.lastFailure.stage ?? "unknown"}`);
    console.log(`     error : ${health.lastFailure.error ?? "(no detail recorded)"}`);
  }

  if (recent.length > 0) {
    console.log("");
    console.log(`  Last ${recent.length} run(s):`);
    for (const run of recent) {
      const mark = run.status === BACKUP_RUN_STATUS.succeeded ? "✔" : "✖";
      const size = humanBytes(run.databaseBytes);
      const images = run.imageCount === null ? "—" : `${run.imageCount} image(s)`;
      console.log(
        `    ${mark} ${run.finishedAt.toISOString()}  db ${size}  ${images}` +
          `${run.destination ? `  -> ${run.destination}` : ""}` +
          `${run.status === BACKUP_RUN_STATUS.failed ? `  [${run.failedStage ?? "?"}]` : ""}`
      );
    }
  }

  console.log(RULE);

  if (health.stale) {
    console.log("");
    console.log("  Nothing here is a fresh copy of the shop. Check, in this order:");
    console.log("    1. the cron entry on the VPS   crontab -l | grep backup");
    console.log("    2. the log it writes to        tail -50 /var/log/organza-backup.log");
    console.log("    3. the R2 credentials in the stack's env file (R2_ACCESS_KEY_ID etc.)");
    console.log("    4. run it by hand              ./ops/backup.sh");
    console.log("  See ops/README.md.");
    console.log("");
  }

  // Non-zero so a monitor, or `&&` in a shell, treats a stale backup as the
  // failure it is. Every other exit here is a success.
  process.exitCode = health.stale ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
