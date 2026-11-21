import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { UpdateVariantInput } from "@store/shared/schemas/product";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import { DEFAULT_POINT_STOCK } from "@/constants/numberedShawl";
import { initOptionValueNotes, type OptionValueNoteMap } from "@/lib/option-value-notes";
import type { PlacedShawlPoint, ShawlPoint } from "@/types/numberedShawl";

// The product's own isNumbered flag, never inferred from its variant types; the backend enforces the same.
export function showNumberedShawlEditor(product: Pick<Product, "isNumbered">): boolean {
  return product.isNumbered;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function roundPercent(value: number): number {
  return Math.round(clampPercent(value) * 100) / 100;
}

// Every number, placed or not: a numbered product has no other list to change its quantity in.
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

// Keyed by point, not option value: a number placed this session has no value until the save.
export function initPointNotes(product: Product): OptionValueNoteMap {
  const byValueId = initOptionValueNotes(product);
  const notes: OptionValueNoteMap = {};
  for (const point of initShawlPoints(product.variants)) {
    const note = point.valueId ? byValueId[point.valueId] : undefined;
    if (note) {
      notes[point.id] = note;
    }
  }
  return notes;
}

export function isPlacedShawlPoint(point: ShawlPoint): point is PlacedShawlPoint {
  return point.x !== null && point.y !== null;
}

export function placedShawlPoints(points: ShawlPoint[]): PlacedShawlPoint[] {
  return points.filter(isPlacedShawlPoint);
}

// The lowest existing unplaced number first: a new "1" would collide with the existing 1 and lose its position.
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

// Only changed fields, like diffVariantEdit.
export function diffShawlPoint(original: Variant, point: ShawlPoint): UpdateVariantInput | null {
  const patch: UpdateVariantInput = {};
  let changed = false;

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
