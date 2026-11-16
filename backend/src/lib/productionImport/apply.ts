import { Prisma } from "@prisma/client";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_TRANSACTION_MAX_WAIT_MS,
  IMPORT_TRANSACTION_TIMEOUT_MS,
  ORDER_NUMBER_SEQUENCE,
  PRODUCT_NUMBER_SEQUENCE,
} from "@/constants";
import { prisma } from "@/lib/prisma";
import type { CatalogueCounts, CatalogueSnapshot, WipedTable } from "@/types";

// ============================================================================
//  The sandbox side of `npm run import:prod` — empty it, then fill it.
//
//  Wiping FIRST is what makes the rest of this file simple. The production
//  ids, SKUs and barcodes are copied VERBATIM (a variant points at an option
//  value by id, an image at its product by id, a product at its category by
//  id — CLAUDE.md rule 2), which only works if nothing in the target can
//  clash with them. An empty table cannot.
//
//  All of it is ONE transaction. A run that dies halfway through rolls back to
//  the catalogue the sandbox already had, rather than leaving a shop with
//  categories and no products in it.
// ============================================================================

type Tx = Prisma.TransactionClient;

interface WipeStep {
  /** Prisma model name — a label for the report, not user-facing text. */
  table: string;
  run(tx: Tx): Promise<{ count: number }>;
}

/**
 * Everything that is not a user account or the shop's own configuration,
 * deleted children-first.
 *
 * What is NOT here is the point of the command: `user`, `account`, `session`,
 * `verification`, `PasswordSetupToken` and `PushSubscription` (so nobody is
 * locked out of the sandbox and a phone that opted into notifications stays
 * opted in), `Setting` (the sandbox keeps its own currency, language and
 * thresholds), `ExpenseCategory` and `BootstrapRecord` (essential data —
 * CLAUDE.md rule 11: bootstrap creates each item once in the life of the
 * database and would not put them back).
 */
const WIPE_STEPS: readonly WipeStep[] = [
  { table: "auditLog", run: (tx) => tx.auditLog.deleteMany() },
  { table: "changeRequest", run: (tx) => tx.changeRequest.deleteMany() },
  { table: "orderItem", run: (tx) => tx.orderItem.deleteMany() },
  { table: "order", run: (tx) => tx.order.deleteMany() },
  { table: "expense", run: (tx) => tx.expense.deleteMany() },
  { table: "cashSession", run: (tx) => tx.cashSession.deleteMany() },
  { table: "productImage", run: (tx) => tx.productImage.deleteMany() },
  { table: "variantValue", run: (tx) => tx.variantValue.deleteMany() },
  { table: "productVariantType", run: (tx) => tx.productVariantType.deleteMany() },
  { table: "variant", run: (tx) => tx.variant.deleteMany() },
  { table: "product", run: (tx) => tx.product.deleteMany() },
  { table: "category", run: (tx) => tx.category.deleteMany() },
  { table: "variantOptionValue", run: (tx) => tx.variantOptionValue.deleteMany() },
  { table: "variantType", run: (tx) => tx.variantType.deleteMany() },
];

/** A stored JSON value on its way back into a nullable column. */
function nullableJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/** ...and into a required one, where the database guarantees there is a value. */
function requiredJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** `createMany` in batches Postgres's per-statement parameter limit can hold. */
async function insertAll<T>(rows: T[], insert: (chunk: T[]) => Promise<Prisma.BatchPayload>): Promise<number> {
  let written = 0;
  for (let index = 0; index < rows.length; index += IMPORT_BATCH_SIZE) {
    const result = await insert(rows.slice(index, index + IMPORT_BATCH_SIZE));
    written += result.count;
  }
  return written;
}

/**
 * Categories nest into themselves, so they go in depth by depth: a child's
 * `parentId` has to point at a row that is already there.
 *
 * A row whose parent is missing from the snapshot entirely would loop
 * forever, so the remainder is written flat at the end and left for the
 * foreign key to judge — inside the transaction, where a failure costs
 * nothing.
 */
function categoryLayers(categories: CatalogueSnapshot["categories"]): CatalogueSnapshot["categories"][] {
  const layers: CatalogueSnapshot["categories"][] = [];
  const placed = new Set<string>();
  let remaining = categories;

  while (remaining.length > 0) {
    const layer = remaining.filter((row) => row.parentId === null || placed.has(row.parentId));
    if (layer.length === 0) {
      layers.push(remaining);
      break;
    }
    for (const row of layer) placed.add(row.id);
    layers.push(layer);
    remaining = remaining.filter((row) => !placed.has(row.id));
  }

  return layers;
}

/**
 * Sequences carry human-facing numbers, and a fresh sandbox's are at 1 while
 * the imported rows are in the hundreds — so the next product added by hand
 * would collide on `productNumber` (and therefore on the SKU built from it,
 * which is frozen at creation — CLAUDE.md rule 1).
 *
 * Orders are not imported at all, so theirs goes back to the start: two runs
 * of this command leave the sandbox in the same state, down to the number the
 * next sale will be given.
 */
async function realignSequences(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT setval(
       pg_get_serial_sequence('${PRODUCT_NUMBER_SEQUENCE.table}', '${PRODUCT_NUMBER_SEQUENCE.column}'),
       COALESCE((SELECT MAX("${PRODUCT_NUMBER_SEQUENCE.column}") FROM ${PRODUCT_NUMBER_SEQUENCE.table}), 1),
       (SELECT MAX("${PRODUCT_NUMBER_SEQUENCE.column}") FROM ${PRODUCT_NUMBER_SEQUENCE.table}) IS NOT NULL
     )`
  );
  await tx.$executeRawUnsafe(
    `SELECT setval(
       pg_get_serial_sequence('${ORDER_NUMBER_SEQUENCE.table}', '${ORDER_NUMBER_SEQUENCE.column}'), 1, false
     )`
  );
}

export interface AppliedImport {
  wiped: WipedTable[];
  imported: CatalogueCounts;
}

/**
 * Empties the sandbox of everything but its people, writes production's
 * catalogue in its place, and puts the sequences where the new data leaves
 * them. One transaction, so it either all happened or none of it did.
 */
export async function applyCatalogue(snapshot: CatalogueSnapshot): Promise<AppliedImport> {
  return prisma.$transaction(
    async (tx) => {
      const wiped: WipedTable[] = [];
      for (const step of WIPE_STEPS) {
        const { count } = await step.run(tx);
        wiped.push({ table: step.table, deleted: count });
      }

      let categories = 0;
      for (const layer of categoryLayers(snapshot.categories)) {
        categories += await insertAll(layer, (chunk) =>
          tx.category.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) })
        );
      }

      const variantTypes = await insertAll(snapshot.variantTypes, (chunk) =>
        tx.variantType.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) })
      );

      const variantOptionValues = await insertAll(snapshot.variantOptionValues, (chunk) =>
        tx.variantOptionValue.createMany({
          data: chunk.map((row) => ({ ...row, value: requiredJson(row.value) })),
        })
      );

      const products = await insertAll(snapshot.products, (chunk) =>
        tx.product.createMany({
          data: chunk.map((row) => ({
            ...row,
            name: requiredJson(row.name),
            description: nullableJson(row.description),
            // The one field deliberately NOT copied: who added the product is
            // a member of the shop's staff, and production's user ids mean
            // nothing here. Nullable exactly for this (the column already
            // allows it for a product whose author has left).
            createdById: null,
          })),
        })
      );

      const variants = await insertAll(snapshot.variants, (chunk) =>
        tx.variant.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) })
      );

      const productVariantTypes = await insertAll(snapshot.productVariantTypes, (chunk) =>
        tx.productVariantType.createMany({ data: chunk })
      );

      const variantValues = await insertAll(snapshot.variantValues, (chunk) =>
        tx.variantValue.createMany({ data: chunk })
      );

      const productImages = await insertAll(snapshot.productImages, (chunk) =>
        // `edit` is the crop the shop drew on this photograph (shared's
        // ImageEdit) and comes across with it, so the sandbox's catalogue
        // shows the same framing production does — and Prisma wants a
        // missing one spelled DbNull rather than null, like every other
        // nullable Json column here.
        tx.productImage.createMany({ data: chunk.map((row) => ({ ...row, edit: nullableJson(row.edit) })) })
      );

      await realignSequences(tx);

      return {
        wiped,
        imported: {
          categories,
          variantTypes,
          variantOptionValues,
          products,
          variants,
          productVariantTypes,
          variantValues,
          productImages,
        },
      };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS }
  );
}
