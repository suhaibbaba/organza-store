#!/usr/bin/env tsx
// ============================================================================
//  npm run import:prod — copy the LIVE shop's catalogue into the SANDBOX.
//
//  One way, always. It reads production and writes the sandbox, and it is
//  built so that it cannot do the reverse:
//
//    · the target must declare itself sandbox in APP_ENV *and* carry
//      "sandbox" in its own database name — two independent facts that have
//      to agree, with no override for either;
//    · the run must name the database it is about to empty
//      (ORGANZA_IMPORT_CONFIRM=<database>);
//    · the production connection is opened READ-ONLY at the server and is
//      proven so — with a write that has to fail — before a row is read;
//    · the client that reaches production never leaves lib/productionImport/
//      source.ts, so no other module in this codebase holds an object that
//      could write to the live shop.
//
//  It is a terminal command over SSH and never a button: this is used a
//  handful of times a year, and a mis-tap would empty an environment — while
//  putting it in the app would mean keeping production's credentials inside
//  the sandbox's own deployment, where they are least protected.
//
//  WHAT CROSSES OVER: categories, products (including hidden and
//  soft-deleted ones), variants, the global variant types and their option
//  values, images, barcodes, SKUs, prices and stock — with production's ids
//  copied verbatim, so every relation resolves without remapping.
//
//  WHAT NEVER DOES: orders, users, expenses, cash sessions, change requests,
//  push subscriptions and the audit log. No customer or staff data leaves the
//  live shop.
//
//  WHAT THE SANDBOX KEEPS: its staff accounts, their credentials and their
//  sessions (you are never locked out), its Setting row, its expense
//  categories and its bootstrap record.
// ============================================================================
import "dotenv/config";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/image";
import { describeAppEnv } from "@/lib/dangerousCommands";
import { canReadUploadDir, runProductionImport } from "@/lib/productionImport";
import { COMMAND_RULE as RULE, PRODUCTION_IMPORT_ENV, PRODUCTION_IMPORT_FLAGS } from "@/constants";
import type { ProductionImportSummary } from "@/types";

/**
 * Production's uploads directory, or null when the run said to skip the
 * files. Refuses rather than importing rows whose photographs will 404: a
 * catalogue of grey boxes is not what anybody asked for, and finding out
 * afterwards costs another full run.
 */
async function resolveUploadSource(argv: string[]): Promise<string | null> {
  if (argv.includes(PRODUCTION_IMPORT_FLAGS.skipImages)) return null;

  const configured = process.env[PRODUCTION_IMPORT_ENV.uploadDir]?.trim();
  if (!configured) {
    throw new Error(
      [
        `${PRODUCTION_IMPORT_ENV.uploadDir} is not set, so the photographs cannot be copied.`,
        "",
        "  Point it at production's UPLOAD_DIR as THIS machine can see it — the",
        "  mounted volume, or a copy synced across first. On the VPS that is:",
        "",
        "      docker volume inspect organza-production_production_uploads",
        "",
        "  Or import the rows without the pictures, knowingly:",
        `      npm run import:prod -- ${PRODUCTION_IMPORT_FLAGS.skipImages}`,
      ].join("\n")
    );
  }

  const directory = path.resolve(configured);
  if (!(await canReadUploadDir(directory))) {
    throw new Error(
      `${PRODUCTION_IMPORT_ENV.uploadDir} points at ${directory}, which is not a readable directory here.`
    );
  }
  return directory;
}

function report(summary: ProductionImportSummary, uploadSource: string | null): void {
  const { imported, images } = summary;

  console.log("");
  console.log(RULE);
  console.log("  Wiped from the sandbox");
  console.log(RULE);
  for (const { table, deleted } of summary.wiped) {
    console.log(`    ${table.padEnd(20)} ${String(deleted).padStart(7)}`);
  }
  console.log("    ─");
  console.log("    kept: user accounts, credentials, sessions, push subscriptions,");
  console.log("          settings, expense categories, bootstrap record");

  console.log("");
  console.log(RULE);
  console.log("  Imported from production");
  console.log(RULE);
  console.log(`    categories           ${String(imported.categories).padStart(7)}`);
  console.log(`    products             ${String(imported.products).padStart(7)}`);
  console.log(`    variants             ${String(imported.variants).padStart(7)}`);
  console.log(`    variant types        ${String(imported.variantTypes).padStart(7)}`);
  console.log(`    option values        ${String(imported.variantOptionValues).padStart(7)}`);
  console.log(`    product ↔ type       ${String(imported.productVariantTypes).padStart(7)}`);
  console.log(`    variant ↔ value      ${String(imported.variantValues).padStart(7)}`);
  console.log(`    images (rows)        ${String(imported.productImages).padStart(7)}`);
  console.log("    ─");
  console.log("    not imported: orders, users, expenses, cash sessions, approvals,");
  console.log("                  push subscriptions, audit log");

  console.log("");
  console.log(RULE);
  console.log("  Photographs");
  console.log(RULE);
  if (images.skipped) {
    console.log(`    skipped (${PRODUCTION_IMPORT_FLAGS.skipImages}) — the imported products have no files yet`);
  } else {
    console.log(`    from                 ${uploadSource}`);
    console.log(`    to                   ${UPLOAD_DIR}`);
    console.log(`    copied               ${String(images.copied).padStart(7)} file(s)`);
    console.log(`    missing in production ${String(images.missing).padStart(6)} file(s)`);
    for (const example of images.missingExamples) console.log(`        · ${example}`);
    if (images.missing > images.missingExamples.length) {
      console.log(`        · …and ${images.missing - images.missingExamples.length} more`);
    }
  }
  console.log(`    removed (stale)      ${String(images.removed).padStart(7)} file(s)`);

  console.log("");
  console.log(RULE);
  console.log(`  Done. ${summary.preservedUsers} staff account(s) untouched — sign in exactly as before.`);
  console.log(RULE);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // Before anything else, so a missing PRODUCTION_UPLOAD_DIR costs nothing.
  const uploadSource = await resolveUploadSource(argv);

  const summary = await runProductionImport({
    productionUploadDir: uploadSource,
    onResolved: (endpoints) => {
      console.log(RULE);
      console.log("  Organza — importing the production catalogue into the sandbox");
      console.log(RULE);
      console.log(`  Source   : ${endpoints.source}   (read-only)`);
      console.log(`  Target   : ${endpoints.target}`);
      console.log(`  APP_ENV  : ${describeAppEnv()}`);
      console.log(`  Uploads  : ${uploadSource ?? "(skipped)"}  ->  ${UPLOAD_DIR}`);
      console.log(RULE);
      console.log("");
    },
    onProgress: (message) => console.log(`==> ${message}`),
  });

  report(summary, uploadSource);
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
