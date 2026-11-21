import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { variantSku } from "@/lib/sku";
import { generateUniqueBarcode } from "@/lib/barcode";
import { buildComboName, buildImagePointMap, cartesianProduct, resolveComboImagePoint } from "@/lib/variantCombo";
import { assertOptionTypesMatchMode } from "@/lib/numberedProduct";
import { DEFAULT_STOCK, ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types/changeRequest";
import type { I18n, OptionValueLookup } from "@/types";

// Variant generation in one place, shared by direct edits and approved requests so both produce the same variants.

export interface OptionSelectionInput {
  variantTypeId: string;
  valueIds: string[];
  imagePoints?: Record<string, { imageX: number; imageY: number }>;
}

/** Checks each value belongs to its type and the types suit the product (numbered sells numbers only); returns id → value. */
export async function validateOptionSelections(
  selections: OptionSelectionInput[],
  isNumbered: boolean,
  client: DbClient = prisma,
): Promise<Map<string, OptionValueLookup>> {
  const valueMap = new Map<string, OptionValueLookup>();
  const typeSlugs: string[] = [];
  for (const sel of selections) {
    const vt = await client.variantType.findUnique({ where: { id: sel.variantTypeId }, include: { values: true } });
    if (!vt) {
      throw new AppError(400, ERROR_CODES.VARIANT_TYPE_NOT_FOUND);
    }
    typeSlugs.push(vt.slug);
    const validIds = new Set(vt.values.map((v) => v.id));
    for (const valueId of sel.valueIds) {
      if (!validIds.has(valueId)) {
        throw new AppError(400, ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND);
      }
    }
    for (const v of vt.values) {
      if (sel.valueIds.includes(v.id)) {
        valueMap.set(v.id, { id: v.id, value: v.value as I18n });
      }
    }
  }
  // Refused, not filtered: colours on a numbered product are a misunderstanding.
  assertOptionTypesMatchMode(isNumbered, typeSlugs);
  return valueMap;
}

/** The product fields generation needs — deliberately not the route's include type. */
export interface GeneratableProduct {
  id: string;
  productNumber: number;
  sku: string | null;
  variants: { variantNumber: number; values: { optionValueId: string }[] }[];
}

/** Every combination the selections describe, named as generated — to preview what a pending request would add. */
export function previewComboNames(
  selections: OptionSelectionInput[],
  valueMap: Map<string, OptionValueLookup>,
): I18n[] {
  return cartesianProduct(selections.map((s) => s.valueIds)).map((combo) =>
    buildComboName(combo.map((valueId) => valueMap.get(valueId)!)),
  );
}

/** Additive generation: existing combos are untouched; takes the client so it can run inside an approval's transaction. */
export function comboStockLookup(entries: { valueIds: string[]; stock: number }[] = []): (combo: string[]) => number {
  const stocks = new Map(entries.map((entry) => [[...entry.valueIds].sort().join(","), entry.stock]));
  return (combo) => stocks.get([...combo].sort().join(",")) ?? DEFAULT_STOCK;
}

export async function generateVariantsForProduct(
  client: DbClient,
  product: GeneratableProduct,
  selections: OptionSelectionInput[],
  valueMap: Map<string, OptionValueLookup>,
  comboStocks: { valueIds: string[]; stock: number }[] = [],
): Promise<{ createdSkus: string[] }> {
  const stockFor = comboStockLookup(comboStocks);
  const typeIds = [...new Set(selections.map((s) => s.variantTypeId))];
  await client.productVariantType.createMany({
    data: typeIds.map((variantTypeId) => ({ productId: product.id, variantTypeId })),
    skipDuplicates: true,
  });

  const existingCombos = new Set(
    product.variants.map((v) =>
      v.values
        .map((vv) => vv.optionValueId)
        .sort()
        .join(","),
    ),
  );

  const combos = cartesianProduct(selections.map((s) => s.valueIds));
  const imagePointMap = buildImagePointMap(selections);
  let nextNumber = product.variants.reduce((max, v) => Math.max(max, v.variantNumber), 0);
  const createdSkus: string[] = [];

  for (const combo of combos) {
    const key = [...combo].sort().join(",");
    if (existingCombos.has(key)) {
      continue;
    } // already generated — leave as-is

    nextNumber += 1;
    const values = combo.map((valueId) => valueMap.get(valueId)!);
    const point = resolveComboImagePoint(combo, imagePointMap);
    const sku = variantSku(product.productNumber, nextNumber);
    await client.variant.create({
      data: {
        productId: product.id,
        variantNumber: nextNumber,
        name: buildComboName(values),
        sku,
        barcode: await generateUniqueBarcode(client),
        stock: stockFor(combo),
        imageX: point?.imageX ?? null,
        imageY: point?.imageY ?? null,
        values: { create: combo.map((optionValueId) => ({ optionValueId })) },
      },
    });
    createdSkus.push(sku);
  }

  // Going from simple to variants, the product's own sku is no longer used.
  if (createdSkus.length && product.sku) {
    await client.product.update({ where: { id: product.id }, data: { sku: null } });
  }

  return { createdSkus };
}
