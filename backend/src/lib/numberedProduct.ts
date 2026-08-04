import { NUMBER_VARIANT_TYPE_SLUG } from "@shared/constants/variantType";
import type { AnyRecord } from "@/types";

// Everything the backend knows about "is this a numbered shawl" lives here
// (spec.md "Numbered shawls"). A numbered product is not a new product type:
// it is an ordinary product using the global Number variant type, whose
// option values double as the numbers drawn on its single photo.
//
// Callers pass the full Prisma product record — variantTypes including their
// variantType, variants including values.optionValue — which is exactly what
// the products router already loads.

function numberTypeIds(product: AnyRecord): Set<string> {
  return new Set<string>(
    (product.variantTypes ?? [])
      .filter((pvt: AnyRecord) => pvt.variantType?.slug === NUMBER_VARIANT_TYPE_SLUG)
      .map((pvt: AnyRecord) => pvt.variantType.id as string)
  );
}

export function isNumberedProduct(product: AnyRecord): boolean {
  return numberTypeIds(product).size > 0;
}

// Counted from the distinct Number values, not from variants: a product that
// also has colours multiplies its combinations without offering more numbers.
export function summarizeNumbers(product: AnyRecord): { isNumbered: boolean; numberCount: number } {
  const typeIds = numberTypeIds(product);
  if (typeIds.size === 0) return { isNumbered: false, numberCount: 0 };

  const numberValueIds = new Set<string>();
  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    for (const vv of (variant.values ?? []) as AnyRecord[]) {
      if (typeIds.has(vv.optionValue.variantTypeId)) numberValueIds.add(vv.optionValue.id);
    }
  }
  return { isNumbered: true, numberCount: numberValueIds.size };
}

// The pick-one list a POS shows after a numbered shawl's parent label is
// scanned. One entry per variant carrying a Number value, so every entry is
// something that can actually be put on an order line — the parent itself
// never is.
//
// `serializedVariants` are the same variants already run through
// serializeVariant, so price fallback (CLAUDE.md rule 3) is resolved exactly
// once, in one place. `cost` is deliberately not carried over: picking a
// number needs the sale price, and cost is Admin/Manager-only (rule 19).
export function buildNumberOptions(product: AnyRecord, serializedVariants: AnyRecord[]): AnyRecord[] {
  const typeIds = numberTypeIds(product);
  if (typeIds.size === 0) return [];

  const serializedById = new Map<string, AnyRecord>(serializedVariants.map((v: AnyRecord) => [v.id, v]));
  const options: AnyRecord[] = [];

  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    const numberValue = (variant.values ?? []).find((vv: AnyRecord) => typeIds.has(vv.optionValue.variantTypeId));
    // A combination that carries no number isn't one of the numbers.
    if (!numberValue) continue;
    const dto = serializedById.get(variant.id);
    if (!dto) continue;

    options.push({
      variantId: dto.id,
      variantNumber: dto.variantNumber,
      name: dto.name,
      number: numberValue.optionValue.value,
      numberKey: numberValue.optionValue.key,
      sku: dto.sku,
      barcode: dto.barcode,
      resolvedPrice: dto.resolvedPrice,
      stock: dto.stock,
      // Sold out, or hidden by an Admin/Manager. Flagged rather than dropped:
      // the cashier needs to see that number 5 exists and is gone, otherwise
      // they hunt for a label that will never scan.
      available: dto.isActive && dto.stock > 0,
      imageX: dto.imageX ?? null,
      imageY: dto.imageY ?? null,
    });
  }

  return options;
}
