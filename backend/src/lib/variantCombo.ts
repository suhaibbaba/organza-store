import { SUPPORTED_LANGUAGES } from "@/constants";
import type { I18n, OptionValueLookup } from "@/types";

// Cartesian product of the selected values per type: Color[red, blue] × Size[M, L] → 4 combos.
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])), [[]]);
}

export interface ImagePoint {
  imageX: number;
  imageY: number;
}

// Numbered shawls: flattens per-value image points into one optionValueId → point lookup.
export function buildImagePointMap(
  selections: { imagePoints?: Record<string, ImagePoint> }[],
): Map<string, ImagePoint> {
  const map = new Map<string, ImagePoint>();
  for (const selection of selections) {
    if (!selection.imagePoints) {
      continue;
    }
    for (const [valueId, point] of Object.entries(selection.imagePoints)) {
      map.set(valueId, point);
    }
  }
  return map;
}

// A combo is one variant's value ids; numbered shawls select only Number, so at most one id carries a point.
export function resolveComboImagePoint(combo: string[], pointMap: Map<string, ImagePoint>): ImagePoint | undefined {
  for (const valueId of combo) {
    const point = pointMap.get(valueId);
    if (point) {
      return point;
    }
  }
  return undefined;
}

// Suggested variant name like "أحمر / M", falling back to the default language per value.
export function buildComboName(values: Pick<OptionValueLookup, "value">[]): I18n {
  const name: I18n = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    name[lang] = values.map((v) => v.value[lang] ?? v.value.ar).join(" / ");
  }
  return name;
}
