import type { Product } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import type { UpdateVariantInput } from "@organza/shared/schemas/product";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { DEFAULT_POINT_STOCK } from "@/constants/numberedShawl";
import { initOptionValueNotes, type OptionValueNoteMap } from "@/lib/option-value-notes";
import type { PlacedShawlPoint, ShawlPoint } from "@/types/numberedShawl";

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

// Every number the product has, placed on the photo or not. A number
// without coordinates (made before it was put on the photo, or copied in
// from elsewhere) used to be left out here — and since a numbered product
// has no other variant list, its quantity could then be changed nowhere.
// Only the canvas narrows this to the placed ones (placedShawlPoints).
export function initShawlPoints(variants: Variant[]): ShawlPoint[] {
  return variants
    .filter((v) => v.values.length > 0)
    .map((v) => ({
      id: v.id,
      number: Number(v.values[0]?.key ?? 0),
      x: v.imageX ?? null,
      y: v.imageY ?? null,
      stock: String(v.stock),
      priceOverride: v.priceOverride ?? "",
      variantId: v.id,
      valueId: v.values[0]?.id ?? null,
    }))
    .sort((a, b) => a.number - b.number);
}

// The notes this shawl's numbers already carry, keyed the way the editor
// keys its rows — by POINT, not by option value (spec.md "Notes on a
// product's options"). A number placed in the current session has no global
// value yet, so the editor cannot key by value until the save resolves one.
export function initPointNotes(product: Product): OptionValueNoteMap {
  const byValueId = initOptionValueNotes(product);
  const notes: OptionValueNoteMap = {};
  for (const point of initShawlPoints(product.variants)) {
    const note = point.valueId ? byValueId[point.valueId] : undefined;
    if (note) notes[point.id] = note;
  }
  return notes;
}

export function isPlacedShawlPoint(point: ShawlPoint): point is PlacedShawlPoint {
  return point.x !== null && point.y !== null;
}

export function placedShawlPoints(points: ShawlPoint[]): PlacedShawlPoint[] {
  return points.filter(isPlacedShawlPoint);
}

// The number a tap on the photo should place: the lowest one that exists but
// is not on the photo yet, before any new number is made. Placing "1" again
// as a brand-new point would collide with the existing 1 — the save leaves an
// existing number untouched, so its position was silently thrown away.
export function firstUnplacedPoint(points: ShawlPoint[]): ShawlPoint | null {
  return points.filter((p) => !isPlacedShawlPoint(p)).sort((a, b) => a.number - b.number)[0] ?? null;
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

  // An unplaced number has no position to send; once placed, it is sent
  // like any move.
  if (isPlacedShawlPoint(point)) {
    const x = roundPercent(point.x);
    const y = roundPercent(point.y);
    if (x !== original.imageX || y !== original.imageY) {
      patch.imageX = x;
      patch.imageY = y;
      changed = true;
    }
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
