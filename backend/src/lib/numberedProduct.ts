import { NUMBER_VARIANT_TYPE_SLUG } from "@organza/shared/constants/variantType";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { AnyRecord } from "@/types";

// Everything the backend knows about "is this a numbered shawl" lives here
// (spec.md "Numbered shawls"). A numbered product is not a new product type:
// it is an ordinary product whose variants are the numbers drawn on its single
// photo. Which of the two it is, though, is NOT inferred from the variant
// types it happens to use — it is the product's own `isNumbered` flag, chosen
// when the product is added. The flag is what the UI branches on and what the
// rules below are enforced against, so a numbered product can never quietly
// acquire a colour, nor an ordinary one a number.
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
  return product.isNumbered === true;
}

// The rule that gives the flag its teeth (spec.md: a numbered shawl has no
// sizes/colours, just numbers). Enforced on the backend, not merely hidden in
// the UI, wherever variants are generated from option selections.
export function assertOptionTypesMatchMode(isNumbered: boolean, typeSlugs: string[]): void {
  const usesNumbers = typeSlugs.some((slug) => slug === NUMBER_VARIANT_TYPE_SLUG);
  const usesOthers = typeSlugs.some((slug) => slug !== NUMBER_VARIANT_TYPE_SLUG);

  if (isNumbered && usesOthers) throw new AppError(400, ERROR_CODES.PRODUCT_NUMBERED_ONLY_NUMBERS);
  if (!isNumbered && usesNumbers) throw new AppError(400, ERROR_CODES.PRODUCT_NUMBERS_REQUIRE_NUMBERED);
}

// Counted from the distinct Number values rather than from the variant rows:
// the flag says the product is numbered, this says how many numbers it
// actually offers (0 on one whose points haven't been placed yet).
export function summarizeNumbers(product: AnyRecord): { isNumbered: boolean; numberCount: number } {
  if (!isNumberedProduct(product)) return { isNumbered: false, numberCount: 0 };

  const typeIds = numberTypeIds(product);
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
  if (!isNumberedProduct(product)) return [];

  const typeIds = numberTypeIds(product);
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
