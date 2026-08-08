#!/usr/bin/env tsx
// ============================================================================
//  npm run db:reset — wipe the database and start again.
//
//  DESTRUCTIVE, MANUAL ONLY. It drops every table, re-applies every migration
//  and removes uploaded image files that no longer belong to anything. It is
//  not in the deploy pipeline, has no scheduled caller, and refuses to run
//  without being told, in full, that this is what you want — twice over if the
//  process is running as production (see lib/dangerousCommands.ts).
//
//  It seeds NOTHING. What comes next is deliberate and separate:
//      npm run bootstrap    # settings, variant types, expense categories
//      npm run init         # the real staff accounts, by email
// ============================================================================
import "dotenv/config";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/image";
import { assertDestructiveConfirmed, describeDatabase, isProductionEnv } from "@/lib/dangerousCommands";
import { DANGEROUS_COMMAND_ENV } from "@/constants";

const RULE = "═".repeat(74);

/**
 * Every file under UPLOAD_DIR that no ProductImage row claims.
 *
 * A stored image is one base name and three files
 * (`<name>-thumbnail.webp`, `-medium`, `-full`), so a file belongs to a row
 * when its base name matches that row's `filename`. Run straight after a
 * reset that is every file there is — which is the point: a wiped database
 * with a full uploads folder is gigabytes of pictures of nothing.
 */
async function deleteOrphanedUploads(): Promise<{ deleted: number; kept: number }> {
  let entries: string[];
  try {
    entries = await fs.readdir(UPLOAD_DIR);
  } catch {
    // No uploads folder yet — nothing to clean.
    return { deleted: 0, kept: 0 };
  }

  const claimed = new Set(
    (await prisma.productImage.findMany({ select: { filename: true } })).map((row) => row.filename)
  );

  let deleted = 0;
  let kept = 0;
  for (const entry of entries) {
    const base = entry.replace(/-(thumbnail|medium|full)\.webp$/, "");
    if (claimed.has(base)) {
      kept += 1;
      continue;
    }
    const target = path.join(UPLOAD_DIR, entry);
    const stat = await fs.stat(target).catch(() => null);
    // Only files. A directory in here is not something this command invented
    // and not something it will remove.
    if (!stat?.isFile()) continue;
    await fs.unlink(target).catch(() => undefined);
    deleted += 1;
  }

  return { deleted, kept };
}

async function main(): Promise<void> {
  assertDestructiveConfirmed({
    command: "db:reset",
    confirmEnv: DANGEROUS_COMMAND_ENV.dbResetConfirm,
    what: "DELETE every product, order, expense, account and audit entry, and remove uploaded images",
  });

  console.log(RULE);
  console.log("  Organza — resetting the database");
  console.log(RULE);
  console.log(`  Database : ${describeDatabase()}`);
  console.log(`  Uploads  : ${UPLOAD_DIR}`);
  console.log(`  NODE_ENV : ${process.env.NODE_ENV ?? "(unset)"}${isProductionEnv() ? "  ← production, overridden" : ""}`);
  console.log(RULE);

  // Drop + re-apply every migration. --skip-seed is belt and braces: the demo
  // seed is no longer wired to `prisma db seed` at all (see package.json), so
  // there is nothing for this to trigger.
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
  const uploads = await deleteOrphanedUploads();
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
