import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import type { UpdateVariantInput } from "@organza/shared/schemas/product";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { DEFAULT_POINT_STOCK } from "@/constants/numberedShawl";
import type { ShawlPoint } from "@/types/numberedShawl";

// Whether to surface the numbered-point placement tool at all. It is the
// product's own explicit choice (spec.md "Numbered shawls" — Product
// .isNumbered), never a guess based on which variant types it happens to use:
// the tool appears on a numbered product and on nothing else, and the backend
// enforces the same rule on every variant it would create.
export function showNumberedShawlEditor(product: Pick<Product, "isNumbered">): boolean {
  return product.isNumbered;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// Two decimals is plenty of precision for a percentage position and keeps
// state/payloads readable.
export function roundPercent(value: number): number {
  return Math.round(clampPercent(value) * 100) / 100;
}

// Only variants that already carry a placed point (imageX/imageY set) seed
// the canvas — a Number variant without coordinates isn't part of this tool
// (CLAUDE.md rule 2/3 aside, spec.md ties numbered shawls to placed points).
export function initShawlPoints(variants: Variant[]): ShawlPoint[] {
  return variants
    .filter((v) => v.imageX != null && v.imageY != null)
    .map((v) => ({
      id: v.id,
      number: Number(v.values[0]?.key ?? 0),
      x: v.imageX as number,
      y: v.imageY as number,
      stock: String(v.stock),
      priceOverride: v.priceOverride ?? "",
      variantId: v.id,
      valueId: v.values[0]?.id ?? null,
    }))
    .sort((a, b) => a.number - b.number);
}

export function nextPointNumber(points: ShawlPoint[]): number {
  return points.reduce((max, p) => Math.max(max, p.number), 0) + 1;
}

export function newShawlPoint(number: number, x: number, y: number): ShawlPoint {
  return {
    id: `new-${crypto.randomUUID()}`,
    number,
    x: roundPercent(x),
    y: roundPercent(y),
    stock: DEFAULT_POINT_STOCK,
    priceOverride: "",
    variantId: null,
    valueId: null,
  };
}

// Only the fields that actually changed vs. the loaded variant go into the
// PATCH body, mirroring lib/validation/variant-edit.ts's diffVariantEdit.
export function diffShawlPoint(original: Variant, point: ShawlPoint): UpdateVariantInput | null {
  const patch: UpdateVariantInput = {};
  let changed = false;

  const x = roundPercent(point.x);
  const y = roundPercent(point.y);
  if (x !== original.imageX || y !== original.imageY) {
    patch.imageX = x;
    patch.imageY = y;
    changed = true;
  }

  const stock = Number(point.stock);
  if (isNonNegativeIntegerString(point.stock) && stock !== original.stock) {
    patch.stock = stock;
    changed = true;
  }

  const priceOverride = point.priceOverride.trim() === "" ? null : point.priceOverride.trim();
  if (priceOverride !== (original.priceOverride ?? null)) {
    patch.priceOverride = priceOverride;
    changed = true;
  }

  return changed ? patch : null;
}
