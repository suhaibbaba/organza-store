import { PrismaClient } from "@prisma/client";
import { READ_ONLY_CONNECTION_OPTION, SOURCE_SNAPSHOT_TIMEOUT_MS } from "@/constants";
import type { CatalogueSnapshot } from "@/types";

// Read-only side of import:prod: the production client never leaves this file, and the connection is read-only at the server.

/** What Postgres says about the session we just opened. */
async function assertSessionIsReadOnly(client: PrismaClient, describedUrl: string): Promise<void> {
  const rows = await client.$queryRaw<{ value: string }[]>`
    SELECT current_setting('transaction_read_only') AS value
  `;
  if (rows[0]?.value !== "on") {
    throw new Error(
      `The production connection to ${describedUrl} is NOT read-only ` +
        `(transaction_read_only = ${rows[0]?.value ?? "unknown"}). ` +
        `Expected the server to have applied "${READ_ONLY_CONNECTION_OPTION}". Refusing to continue.`,
    );
  }

  // Proof, not configuration: attempt a temp-table write and require it to fail.
  let wrote = false;
  try {
    await client.$executeRawUnsafe("CREATE TEMP TABLE store_import_write_probe (probe integer)");
    wrote = true;
  } catch {
    // Exactly what a read-only session is supposed to do.
  }
  if (wrote) {
    throw new Error(
      `The production connection to ${describedUrl} accepted a write. ` +
        "This command may only ever read from the live shop. Refusing to continue.",
    );
  }
}

/** The whole catalogue in one REPEATABLE READ snapshot, loaded into memory before the target is touched. */
export async function readProductionCatalogue(readOnlyUrl: string, describedUrl: string): Promise<CatalogueSnapshot> {
  const client = new PrismaClient({ datasources: { db: { url: readOnlyUrl } } });

  try {
    await assertSessionIsReadOnly(client, describedUrl);

    return await client.$transaction(
      async (tx) => ({
        // Parents before children — the order rows are written back in.
        categories: await tx.category.findMany({ orderBy: { id: "asc" } }),
        variantTypes: await tx.variantType.findMany({ orderBy: { id: "asc" } }),
        variantOptionValues: await tx.variantOptionValue.findMany({ orderBy: { id: "asc" } }),
        products: await tx.product.findMany({ orderBy: { id: "asc" } }),
        variants: await tx.variant.findMany({ orderBy: { id: "asc" } }),
        productVariantTypes: await tx.productVariantType.findMany({
          orderBy: [{ productId: "asc" }, { variantTypeId: "asc" }],
        }),
        variantValues: await tx.variantValue.findMany({
          orderBy: [{ variantId: "asc" }, { optionValueId: "asc" }],
        }),
        productImages: await tx.productImage.findMany({ orderBy: { id: "asc" } }),
      }),
      { isolationLevel: "RepeatableRead", timeout: SOURCE_SNAPSHOT_TIMEOUT_MS },
    );
  } finally {
    await client.$disconnect();
  }
}
