import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { variantSku } from "@/lib/sku";
import { generateUniqueBarcode } from "@/lib/barcode";
import { buildComboName, buildImagePointMap, cartesianProduct, resolveComboImagePoint } from "@/lib/variantCombo";
import { assertOptionTypesMatchMode } from "@/lib/numberedProduct";
import { DEFAULT_STOCK, ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types/changeRequest";
import type { I18n, OptionValueLookup } from "@/types";

// Generating a product's variants from picked option values, in one place.
//
// It lives here rather than inside routes/products.ts because there are now
// two ways for a product to grow variants: an Admin/Manager doing it, and an
// Employee's request being approved later (spec.md "Employee change
// approvals"). Both must produce exactly the same variants, so both call this.

export interface OptionSelectionInput {
  variantTypeId: string;
  valueIds: string[];
  imagePoints?: Record<string, { imageX: number; imageY: number }>;
}

/**
 * Validates that every selected option value actually belongs to its claimed
 * variant type, and that the types themselves suit the kind of product this
 * is (numbered products sell numbers and nothing else — spec.md "Numbered
 * shawls"). Returns a lookup of id -> option value row.
 */
export async function validateOptionSelections(
  selections: OptionSelectionInput[],
  isNumbered: boolean,
  client: DbClient = prisma
): Promise<Map<string, OptionValueLookup>> {
  const valueMap = new Map<string, OptionValueLookup>();
  const typeSlugs: string[] = [];
  for (const sel of selections) {
    const vt = await client.variantType.findUnique({ where: { id: sel.variantTypeId }, include: { values: true } });
    if (!vt) throw new AppError(400, ERROR_CODES.VARIANT_TYPE_NOT_FOUND);
    typeSlugs.push(vt.slug);
    const validIds = new Set(vt.values.map((v) => v.id));
    for (const valueId of sel.valueIds) {
      if (!validIds.has(valueId)) throw new AppError(400, ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND);
    }
    for (const v of vt.values) {
      if (sel.valueIds.includes(v.id)) valueMap.set(v.id, { id: v.id, value: v.value as I18n });
    }
  }
  // Refused loudly rather than filtered out: someone who picked colours for a
  // numbered product has misunderstood the product, not mistyped a field.
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

/**
 * Every combination the selections describe, named the way the generated
 * variant would be named. Used to show an Employee (and the Admin deciding)
 * exactly which variants a pending request would add, without creating any.
 */
export function previewComboNames(
  selections: OptionSelectionInput[],
  valueMap: Map<string, OptionValueLookup>
): I18n[] {
  return cartesianProduct(selections.map((s) => s.valueIds)).map((combo) =>
    buildComboName(combo.map((valueId) => valueMap.get(valueId)!))
  );
}

/**
 * Additive cartesian generation: combinations the product already has are
 * left exactly as they are, so this is safe to re-run and never rewrites a
 * variant somebody has since edited.
 *
 * Takes the client rather than reaching for the global one, so an approval
 * can run it inside its transaction — barcode uniqueness included, since the
 * lookup then sees the rows this same batch has just written.
 */
export async function generateVariantsForProduct(
  client: DbClient,
  product: GeneratableProduct,
  selections: OptionSelectionInput[],
  valueMap: Map<string, OptionValueLookup>
): Promise<{ createdSkus: string[] }> {
  const typeIds = [...new Set(selections.map((s) => s.variantTypeId))];
  await client.productVariantType.createMany({
    data: typeIds.map((variantTypeId) => ({ productId: product.id, variantTypeId })),
    skipDuplicates: true,
  });

  const existingCombos = new Set(
    product.variants.map((v) => v.values.map((vv) => vv.optionValueId).sort().join(","))
  );

  const combos = cartesianProduct(selections.map((s) => s.valueIds));
  const imagePointMap = buildImagePointMap(selections);
  let nextNumber = product.variants.reduce((max, v) => Math.max(max, v.variantNumber), 0);
  const createdSkus: string[] = [];

  for (const combo of combos) {
    const key = [...combo].sort().join(",");
    if (existingCombos.has(key)) continue; // already generated — leave as-is

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
        stock: DEFAULT_STOCK,
        imageX: point?.imageX ?? null,
        imageY: point?.imageY ?? null,
        values: { create: combo.map((optionValueId) => ({ optionValueId })) },
      },
    });
    createdSkus.push(sku);
  }

  // A product transitioning from simple to variant-based no longer uses its
  // own sku (variants own it from here on).
  if (createdSkus.length && product.sku) {
    await client.product.update({ where: { id: product.id }, data: { sku: null } });
  }

  return { createdSkus };
}
