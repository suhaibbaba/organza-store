import { prisma } from "@/lib/prisma";
import { applyCatalogue } from "@/lib/productionImport/apply";
import { syncImageFiles } from "@/lib/productionImport/images";
import { assertConfirmedTarget, resolveImportEndpoints } from "@/lib/productionImport/guards";
import type { ResolvedEndpoints } from "@/lib/productionImport/guards";
import { readProductionCatalogue } from "@/lib/productionImport/source";
import type { ImportEndpoints, ProductionImportSummary } from "@/types";

export * from "@/lib/productionImport/guards";
export * from "@/lib/productionImport/images";
export * from "@/lib/productionImport/source";
export * from "@/lib/productionImport/apply";

export interface ProductionImportOptions {
  /**
   * Production's uploads directory as this machine sees it, or null to import
   * the rows without the files (`--skip-images`).
   */
  productionUploadDir: string | null;
  /**
   * Called the moment the run has been allowed, and before production is
   * read — so the terminal can say where this is pointed *first*, which is
   * the only moment saying so is any use.
   */
  onResolved?(endpoints: ImportEndpoints): void;
  /** Progress for a person watching an SSH session. */
  onProgress?(message: string): void;
}

/**
 * The whole one-way import, in the order the safety depends on:
 *
 *   1. decide the run is pointed the right way round, and refuse if not;
 *   2. read production — read-only, one consistent snapshot, into memory;
 *   3. wipe the sandbox and write that snapshot, in ONE transaction;
 *   4. copy the photographs and clear up the old ones.
 *
 * Reading before writing is deliberate: a production database that is
 * unreachable, or a run that is refused, leaves the sandbox untouched rather
 * than emptied and waiting.
 */
export async function runProductionImport(
  options: ProductionImportOptions
): Promise<ProductionImportSummary> {
  const endpoints: ResolvedEndpoints = resolveImportEndpoints();
  assertConfirmedTarget(endpoints);
  options.onResolved?.(endpoints);

  options.onProgress?.(`Reading the catalogue from ${endpoints.source} (read-only)`);
  const snapshot = await readProductionCatalogue(endpoints.sourceUrl, endpoints.source);

  options.onProgress?.(`Wiping ${endpoints.target} and writing ${snapshot.products.length} product(s)`);
  const applied = await applyCatalogue(snapshot);

  options.onProgress?.(options.productionUploadDir ? "Copying photographs" : "Skipping photographs");
  const images = await syncImageFiles(options.productionUploadDir, snapshot.productImages);

  return {
    endpoints,
    wiped: applied.wiped,
    imported: applied.imported,
    images,
    preservedUsers: await prisma.user.count(),
  };
}
