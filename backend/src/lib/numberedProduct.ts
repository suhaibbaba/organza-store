import { NUMBER_VARIANT_TYPE_SLUG } from "@store/shared/constants/variantType";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { AnyRecord } from "@/types";

// Numbered shawls: an ordinary product whose variants are numbers on one photo, flagged by its own isNumbered, never inferred.

function numberTypeIds(product: AnyRecord): Set<string> {
  return new Set<string>(
    (product.variantTypes ?? [])
      .filter((pvt: AnyRecord) => pvt.variantType?.slug === NUMBER_VARIANT_TYPE_SLUG)
      .map((pvt: AnyRecord) => pvt.variantType.id as string),
  );
}

export function isNumberedProduct(product: AnyRecord): boolean {
  return product.isNumbered === true;
}

// The rule behind the flag: a numbered shawl has numbers only, enforced on the backend wherever variants are generated.
export function assertOptionTypesMatchMode(isNumbered: boolean, typeSlugs: string[]): void {
  const usesNumbers = typeSlugs.some((slug) => slug === NUMBER_VARIANT_TYPE_SLUG);
  const usesOthers = typeSlugs.some((slug) => slug !== NUMBER_VARIANT_TYPE_SLUG);

  if (isNumbered && usesOthers) {
    throw new AppError(400, ERROR_CODES.PRODUCT_NUMBERED_ONLY_NUMBERS);
  }
  if (!isNumbered && usesNumbers) {
    throw new AppError(400, ERROR_CODES.PRODUCT_NUMBERS_REQUIRE_NUMBERED);
  }
}

// Counted from distinct Number values, not variant rows (0 before any point is placed).
export function summarizeNumbers(product: AnyRecord): { isNumbered: boolean; numberCount: number } {
  if (!isNumberedProduct(product)) {
    return { isNumbered: false, numberCount: 0 };
  }

  const typeIds = numberTypeIds(product);
  const numberValueIds = new Set<string>();
  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    for (const vv of (variant.values ?? []) as AnyRecord[]) {
      if (typeIds.has(vv.optionValue.variantTypeId)) {
        numberValueIds.add(vv.optionValue.id);
      }
    }
  }
  return { isNumbered: true, numberCount: numberValueIds.size };
}

// The POS pick-one list after scanning a numbered shawl's parent: one sellable entry per numbered variant, no cost.
export function buildNumberOptions(product: AnyRecord, serializedVariants: AnyRecord[]): AnyRecord[] {
  if (!isNumberedProduct(product)) {
    return [];
  }

  const typeIds = numberTypeIds(product);
  const serializedById = new Map<string, AnyRecord>(serializedVariants.map((v: AnyRecord) => [v.id, v]));
  const options: AnyRecord[] = [];

  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    const numberValue = (variant.values ?? []).find((vv: AnyRecord) => typeIds.has(vv.optionValue.variantTypeId));
    // A combination that carries no number isn't one of the numbers.
    if (!numberValue) {
      continue;
    }
    const dto = serializedById.get(variant.id);
    if (!dto) {
      continue;
    }

    options.push({
      variantId: dto.id,
      variantNumber: dto.variantNumber,
      name: dto.name,
      number: numberValue.optionValue.value,
      numberKey: numberValue.optionValue.key,
      // What this number means on this shawl — shown beside it in the picker, never drawn on the photo.
      note: (dto.values as AnyRecord[] | undefined)?.find((v) => v.id === numberValue.optionValue.id)?.note ?? null,
      sku: dto.sku,
      barcode: dto.barcode,
      resolvedPrice: dto.resolvedPrice,
      stock: dto.stock,
      // Sold out or hidden: flagged, not dropped, so the cashier sees the number exists and is gone.
      available: dto.isActive && dto.stock > 0,
      imageX: dto.imageX ?? null,
      imageY: dto.imageY ?? null,
    });
  }

  return options;
}

// The placed numbers burned into the photo by lib/markedImage.ts, in number order.
export function summarizePoints(product: AnyRecord): { label: string; x: number; y: number; soldOut: boolean }[] {
  if (!isNumberedProduct(product)) {
    return [];
  }
  const typeIds = numberTypeIds(product);
  const points: { label: string; x: number; y: number; soldOut: boolean }[] = [];
  for (const variant of (product.variants ?? []) as AnyRecord[]) {
    if (variant.imageX == null || variant.imageY == null) {
      continue;
    }
    const numberValue = (variant.values ?? []).find((vv: AnyRecord) => typeIds.has(vv.optionValue.variantTypeId));
    if (!numberValue) {
      continue;
    }
    points.push({
      label: String(numberValue.optionValue.key),
      x: variant.imageX,
      y: variant.imageY,
      soldOut: variant.stock <= 0,
    });
  }
  return points.sort((a, b) => Number(a.label) - Number(b.label));
}
