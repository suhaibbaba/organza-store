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
  /** Production's uploads dir as this machine sees it, or null to import rows only (--skip-images). */
  productionUploadDir: string | null;
  /** Called once the run is allowed and before production is read, so the terminal says where it points first. */
  onResolved?(endpoints: ImportEndpoints): void;
  /** Progress for a person watching an SSH session. */
  onProgress?(message: string): void;
}

/** The one-way import in safety order: check, read a read-only snapshot, wipe+write in one transaction, copy photos. */
export async function runProductionImport(options: ProductionImportOptions): Promise<ProductionImportSummary> {
  const endpoints: ResolvedEndpoints = resolveImportEndpoints();
  assertConfirmedTarget(endpoints);
  options.onResolved?.(endpoints);

  options.onProgress?.(`Reading the catalogue from ${endpoints.source} (read-only)`);
  const snapshot = await readProductionCatalogue(endpoints.sourceUrl, endpoints.source);

  options.onProgress?.(`Wiping ${endpoints.target} and writing ${snapshot.products.length} product(s)`);
  const applied = await applyCatalogue(snapshot);

  options.onProgress?.(options.productionUploadDir ? "Copying photographs" : "Skipping photographs");
  const setting = await prisma.setting.findFirst({ select: { logoFilename: true } });
  const images = await syncImageFiles(
    options.productionUploadDir,
    snapshot.productImages,
    setting?.logoFilename ? [setting.logoFilename] : [],
  );

  return {
    endpoints,
    wiped: applied.wiped,
    imported: applied.imported,
    images,
    preservedUsers: await prisma.user.count(),
  };
}
