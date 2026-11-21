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

// The sandbox side of import:prod: wipe, then copy production's ids verbatim, all in one transaction.

type Tx = Prisma.TransactionClient;

interface WipeStep {
  /** Prisma model name — a label for the report, not user-facing text. */
  table: string;
  run(tx: Tx): Promise<{ count: number }>;
}

/** Everything except accounts and the shop's own configuration, deleted children-first. */
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

/** Categories go in depth by depth so each parent exists; orphans are written last for the foreign key to judge. */
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
    for (const row of layer) {
      placed.add(row.id);
    }
    layers.push(layer);
    remaining = remaining.filter((row) => !placed.has(row.id));
  }

  return layers;
}

/** Sequences moved past the imported numbers so new products cannot collide (SKUs are frozen, rule 1); orders restart. */
async function realignSequences(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT setval(
       pg_get_serial_sequence('${PRODUCT_NUMBER_SEQUENCE.table}', '${PRODUCT_NUMBER_SEQUENCE.column}'),
       COALESCE((SELECT MAX("${PRODUCT_NUMBER_SEQUENCE.column}") FROM ${PRODUCT_NUMBER_SEQUENCE.table}), 1),
       (SELECT MAX("${PRODUCT_NUMBER_SEQUENCE.column}") FROM ${PRODUCT_NUMBER_SEQUENCE.table}) IS NOT NULL
     )`,
  );
  await tx.$executeRawUnsafe(
    `SELECT setval(
       pg_get_serial_sequence('${ORDER_NUMBER_SEQUENCE.table}', '${ORDER_NUMBER_SEQUENCE.column}'), 1, false
     )`,
  );
}

export interface AppliedImport {
  wiped: WipedTable[];
  imported: CatalogueCounts;
}

/** Wipes everything but people, writes production's catalogue and fixes sequences — one transaction. */
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
          tx.category.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) }),
        );
      }

      const variantTypes = await insertAll(snapshot.variantTypes, (chunk) =>
        tx.variantType.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) }),
      );

      const variantOptionValues = await insertAll(snapshot.variantOptionValues, (chunk) =>
        tx.variantOptionValue.createMany({
          data: chunk.map((row) => ({ ...row, value: requiredJson(row.value) })),
        }),
      );

      const products = await insertAll(snapshot.products, (chunk) =>
        tx.product.createMany({
          data: chunk.map((row) => ({
            ...row,
            name: requiredJson(row.name),
            description: nullableJson(row.description),
            // createdById is not copied: production's user ids mean nothing here.
            createdById: null,
            // Production's burned-in pictures are not copied; images:mark rebuilds them here.
            markedImage: Prisma.DbNull,
          })),
        }),
      );

      const variants = await insertAll(snapshot.variants, (chunk) =>
        tx.variant.createMany({ data: chunk.map((row) => ({ ...row, name: requiredJson(row.name) })) }),
      );

      const productVariantTypes = await insertAll(snapshot.productVariantTypes, (chunk) =>
        tx.productVariantType.createMany({ data: chunk }),
      );

      const variantValues = await insertAll(snapshot.variantValues, (chunk) =>
        tx.variantValue.createMany({ data: chunk }),
      );

      const productImages = await insertAll(snapshot.productImages, (chunk) =>
        // The photo's crop comes across too; Prisma wants DbNull, not null, for a missing Json value.
        tx.productImage.createMany({ data: chunk.map((row) => ({ ...row, edit: nullableJson(row.edit) })) }),
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
    { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS },
  );
}
