import { SUPPORTED_LANGUAGES } from "@/constants";
import type { I18n, OptionValueLookup } from "@/types";

// Cartesian product of the selected values per variant type, e.g.
// Color[red, blue] x Size[M, L] -> [[red,M],[red,L],[blue,M],[blue,L]]
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])), [[]]);
}

export interface ImagePoint {
  imageX: number;
  imageY: number;
}

// Numbered shawls (spec.md): flattens every selection's optional per-value
// image points into a single optionValueId -> point lookup.
export function buildImagePointMap(selections: { imagePoints?: Record<string, ImagePoint> }[]): Map<string, ImagePoint> {
  const map = new Map<string, ImagePoint>();
  for (const selection of selections) {
    if (!selection.imagePoints) continue;
    for (const [valueId, point] of Object.entries(selection.imagePoints)) map.set(valueId, point);
  }
  return map;
}

// A combo is one generated variant's option value ids across every selected
// type; numbered shawls only ever select a single type (Number), so at most
// one id in the combo carries a point.
export function resolveComboImagePoint(combo: string[], pointMap: Map<string, ImagePoint>): ImagePoint | undefined {
  for (const valueId of combo) {
    const point = pointMap.get(valueId);
    if (point) return point;
  }
  return undefined;
}

// Auto-suggested variant name from its option combination, e.g. "أحمر / M".
// Falls back to the default-language (ar) label for any language missing on
// a given option value, so every language key still gets a usable string.
export function buildComboName(values: Pick<OptionValueLookup, "value">[]): I18n {
  const name: I18n = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    name[lang] = values.map((v) => v.value[lang] ?? v.value.ar).join(" / ");
  }
  return name;
}
