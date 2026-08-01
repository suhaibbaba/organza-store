import { SUPPORTED_LANGUAGES } from "@/constants";
import type { I18n, OptionValueLookup } from "@/types";

// Cartesian product of the selected values per variant type, e.g.
// Color[red, blue] x Size[M, L] -> [[red,M],[red,L],[blue,M],[blue,L]]
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])), [[]]);
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
