import type { I18n } from "@organza/shared/types/common";
import type { VariantType } from "@organza/shared/types/variant";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@organza/shared/constants/languages";
import type { VariantSelectionMap } from "@/types/productForm";

// Mirrors backend/src/lib/variantCombo.ts — used client-side only to render
// a live "here's what will be created" preview before submitting.
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])), [[]]);
}

// Order-insensitive identity for a combination of option value ids — used to
// match a preview row back to its real variant after creation, and to detect
// combinations the generate endpoint has already created.
export function comboKey(valueIds: string[]): string {
  return [...valueIds].sort().join(",");
}

export function buildComboName(values: { value: I18n }[]): I18n {
  const name: I18n = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    name[lang] = values.map((v) => v.value[lang] ?? v.value[DEFAULT_LANGUAGE]).join(" / ");
  }
  return name;
}

export interface VariantPreviewRow {
  key: string;
  valueIds: string[];
  name: I18n;
}

// Cartesian preview of the variants a set of selections would generate,
// e.g. Color[أحمر, أزرق] x Size[M, L] -> 4 rows (spec.md).
export function buildVariantPreview(variantTypes: VariantType[], selections: VariantSelectionMap): VariantPreviewRow[] {
  const activeSelections = Object.values(selections).filter((ids) => ids.length > 0);
  if (activeSelections.length === 0) return [];

  const valueLookup = new Map<string, { value: I18n }>();
  for (const type of variantTypes) {
    for (const value of type.values) valueLookup.set(value.id, { value: value.value });
  }

  return cartesianProduct(activeSelections).map((valueIds) => ({
    key: comboKey(valueIds),
    valueIds,
    name: buildComboName(valueIds.map((id) => valueLookup.get(id) ?? { value: { [DEFAULT_LANGUAGE]: "?" } })),
  }));
}

export function toOptionSelections(selections: VariantSelectionMap): { variantTypeId: string; valueIds: string[] }[] {
  return Object.entries(selections)
    .filter(([, valueIds]) => valueIds.length > 0)
    .map(([variantTypeId, valueIds]) => ({ variantTypeId, valueIds }));
}
