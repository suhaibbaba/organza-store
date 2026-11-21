#!/usr/bin/env tsx
// npm run db:reset — DESTRUCTIVE, manual only: drops everything, re-migrates, sweeps orphan uploads; double-confirmed.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/image";
import { claimedImageBases, deleteOrphanedUploads } from "@/lib/uploads";
import { assertDestructiveConfirmed, describeAppEnv, describeDatabase, isProductionEnv } from "@/lib/dangerousCommands";
import { DANGEROUS_COMMAND_ENV } from "@/constants";

const RULE = "═".repeat(74);

/** Every file under UPLOAD_DIR no ProductImage row claims — after a reset, all of them (sweep shared with import:prod). */
async function deleteUploadsBelongingToNothing(): Promise<{ deleted: number; kept: number }> {
  const claimed = claimedImageBases(
    await prisma.productImage.findMany({ select: { filename: true, originalFilename: true } }),
  );
  return deleteOrphanedUploads(claimed);
}

async function main(): Promise<void> {
  assertDestructiveConfirmed({
    command: "db:reset",
    confirmEnv: DANGEROUS_COMMAND_ENV.dbResetConfirm,
    what: "DELETE every product, order, expense, account and audit entry, and remove uploaded images",
  });

  console.log(RULE);
  console.log("  Store Management — resetting the database");
  console.log(RULE);
  console.log(`  Database : ${describeDatabase()}`);
  console.log(`  Uploads  : ${UPLOAD_DIR}`);
  console.log(`  APP_ENV  : ${describeAppEnv()}${isProductionEnv() ? "  ← the live shop, overridden" : ""}`);
  console.log(RULE);

  // Drop + re-apply every migration; --skip-seed is belt and braces, since no seed is wired to prisma db seed.
  console.log("\n==> Dropping the schema and re-applying migrations");
  const migrate = spawnSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    stdio: "inherit",
    shell: true,
    cwd: path.resolve(__dirname, ".."),
  });
  if (migrate.status !== 0) {
    throw new Error("prisma migrate reset failed — the database has NOT been reset.");
  }

  console.log("\n==> Removing uploaded images that belong to nothing");
  const uploads = await deleteUploadsBelongingToNothing();
  console.log(`    deleted ${uploads.deleted} file(s), kept ${uploads.kept}`);

  console.log("");
  console.log(RULE);
  console.log("  Empty. Next:");
  console.log("      npm run bootstrap    # settings, variant types, expense categories");
  console.log("      npm run init         # the real staff accounts, by email");
  console.log(RULE);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
