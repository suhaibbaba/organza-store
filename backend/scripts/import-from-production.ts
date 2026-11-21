#!/usr/bin/env tsx
// npm run import:prod — one-way copy of the live catalogue into the sandbox; see lib/productionImport.
import "dotenv/config";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { UPLOAD_DIR } from "@/lib/image";
import { describeAppEnv } from "@/lib/dangerousCommands";
import { reindexAllProducts } from "@/lib/search";
import { rebuildAllMarkedImages } from "@/lib/markedImage";
import { canReadUploadDir, runProductionImport } from "@/lib/productionImport";
import { COMMAND_RULE as RULE, PRODUCTION_IMPORT_ENV, PRODUCTION_IMPORT_FLAGS } from "@/constants";
import type { ProductionImportSummary } from "@/types";

/** Production's uploads dir, or null to skip files; refuses rather than importing rows whose photos would 404. */
async function resolveUploadSource(argv: string[]): Promise<string | null> {
  if (argv.includes(PRODUCTION_IMPORT_FLAGS.skipImages)) {
    return null;
  }

  const configured = process.env[PRODUCTION_IMPORT_ENV.uploadDir]?.trim();
  if (!configured) {
    throw new Error(
      [
        `${PRODUCTION_IMPORT_ENV.uploadDir} is not set, so the photographs cannot be copied.`,
        "",
        "  Point it at production's UPLOAD_DIR as THIS machine can see it — the",
        "  mounted volume, or a copy synced across first. On the VPS that is:",
        "",
        "      docker volume inspect <production stack>_production_uploads",
        "",
        "  Or import the rows without the pictures, knowingly:",
        `      npm run import:prod -- ${PRODUCTION_IMPORT_FLAGS.skipImages}`,
      ].join("\n"),
    );
  }

  const directory = path.resolve(configured);
  if (!(await canReadUploadDir(directory))) {
    throw new Error(
      `${PRODUCTION_IMPORT_ENV.uploadDir} points at ${directory}, which is not a readable directory here.`,
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
    for (const example of images.missingExamples) {
      console.log(`        · ${example}`);
    }
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
      console.log("  Store Management — importing the production catalogue into the sandbox");
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
  const search = await reindexAllProducts();
  console.log(`==> Search index rebuilt (${search.engine}): ${search.indexed} product(s)`);
  console.log(`==> Numbered photos rebuilt: ${await rebuildAllMarkedImages()} product(s)`);
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
