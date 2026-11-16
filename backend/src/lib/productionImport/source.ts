import { PrismaClient } from "@prisma/client";
import { READ_ONLY_CONNECTION_OPTION, SOURCE_SNAPSHOT_TIMEOUT_MS } from "@/constants";
import type { CatalogueSnapshot } from "@/types";

// ============================================================================
//  The production side of `npm run import:prod` — reading, and nothing else.
//
//  The client that reaches the live shop is created inside this file, used
//  inside this file and disconnected inside this file. It is never exported,
//  never returned and never handed to a caller, so no other module in the
//  codebase HAS an object that could write to production — not "must not",
//  does not.
//
//  On top of that the connection itself is read-only at the server
//  (READ_ONLY_CONNECTION_OPTION), which is checked and then PROVEN with a
//  write that has to fail before a single row is read.
// ============================================================================

/** What Postgres says about the session we just opened. */
async function assertSessionIsReadOnly(client: PrismaClient, describedUrl: string): Promise<void> {
  const rows = await client.$queryRaw<{ value: string }[]>`
    SELECT current_setting('transaction_read_only') AS value
  `;
  if (rows[0]?.value !== "on") {
    throw new Error(
      `The production connection to ${describedUrl} is NOT read-only ` +
        `(transaction_read_only = ${rows[0]?.value ?? "unknown"}). ` +
        `Expected the server to have applied "${READ_ONLY_CONNECTION_OPTION}". Refusing to continue.`
    );
  }

  // Belt and braces, and the only version that is evidence rather than
  // configuration: try to write, and require the attempt to fail. A temporary
  // table is the smallest write there is — it touches nothing the shop owns,
  // and it disappears with the connection even in the impossible case where
  // it succeeds.
  let wrote = false;
  try {
    await client.$executeRawUnsafe("CREATE TEMP TABLE organza_import_write_probe (probe integer)");
    wrote = true;
  } catch {
    // Exactly what a read-only session is supposed to do.
  }
  if (wrote) {
    throw new Error(
      `The production connection to ${describedUrl} accepted a write. ` +
        "This command may only ever read from the live shop. Refusing to continue."
    );
  }
}

/**
 * The whole catalogue, in one consistent snapshot.
 *
 * REPEATABLE READ rather than a series of loose queries: production is a
 * shop that is open, and a variant added between two of these reads would
 * arrive without its parent product. Read-only, so the isolation level costs
 * the live database nothing but a snapshot.
 *
 * Everything is loaded into memory before the target is touched at all —
 * a shop's catalogue is thousands of rows, not millions, and it means a
 * source that goes away mid-read leaves the sandbox exactly as it was.
 */
export async function readProductionCatalogue(
  readOnlyUrl: string,
  describedUrl: string
): Promise<CatalogueSnapshot> {
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
      { isolationLevel: "RepeatableRead", timeout: SOURCE_SNAPSHOT_TIMEOUT_MS }
    );
  } finally {
    await client.$disconnect();
  }
}
