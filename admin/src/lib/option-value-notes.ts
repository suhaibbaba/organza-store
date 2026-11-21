import type { OptionValueNoteInput } from "@store/shared/schemas/product";
import type { I18n } from "@store/shared/types/common";
import type { Product } from "@store/shared/types/product";
import type { VariantType } from "@store/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import type { I18nFormValue, OptionValueNoteGroup, VariantSelectionMap } from "@/types/productForm";

// Keyed by an opaque string, because a numbered shawl's new numbers have no value id until the save.

export type OptionValueNoteMap = Record<string, I18nFormValue>;

const EMPTY: I18nFormValue = { ar: "", en: "", he: "" };

function toFormValue(note: I18n | null | undefined): I18nFormValue {
  return { ar: note?.ar ?? "", en: note?.en ?? "", he: note?.he ?? "" };
}

function isBlank(value: I18nFormValue): boolean {
  return Object.values(value).every((text) => text.trim().length === 0);
}

/** The notes a product already carries, keyed by option value id. */
export function initOptionValueNotes(product: Product | undefined): OptionValueNoteMap {
  const map: OptionValueNoteMap = {};
  for (const entry of product?.optionValueNotes ?? []) {
    map[entry.optionValueId] = toFormValue(entry.note);
  }
  return map;
}

export function noteFor(notes: OptionValueNoteMap, key: string): I18nFormValue {
  return notes[key] ?? EMPTY;
}

export function setNoteLanguage(
  notes: OptionValueNoteMap,
  key: string,
  language: keyof I18nFormValue,
  text: string,
): OptionValueNoteMap {
  return { ...notes, [key]: { ...noteFor(notes, key), [language]: text } };
}

export function countNotes(notes: OptionValueNoteMap): number {
  return Object.values(notes).filter((value) => !isBlank(value)).length;
}

// Only what changed: cleared is null, untouched is omitted, so a save can't overwrite unseen notes.
export function diffOptionValueNotes(
  initial: OptionValueNoteMap,
  current: OptionValueNoteMap,
  resolveOptionValueId: (key: string) => string | null = (key) => key,
): OptionValueNoteInput[] {
  const changes: OptionValueNoteInput[] = [];

  for (const key of new Set([...Object.keys(initial), ...Object.keys(current)])) {
    const before = noteFor(initial, key);
    const after = noteFor(current, key);
    const sameInEveryLanguage = (["ar", "en", "he"] as const).every(
      (language) => before[language].trim() === after[language].trim(),
    );
    if (sameInEveryLanguage) {
      continue;
    }

    const optionValueId = resolveOptionValueId(key);
    if (!optionValueId) {
      continue;
    }

    changes.push({
      optionValueId,
      note: isBlank(after)
        ? null
        : Object.fromEntries(
            (["ar", "en", "he"] as const)
              .map((language) => [language, after[language].trim()] as const)
              .filter(([, text]) => text.length > 0),
          ),
    });
  }

  return changes;
}

export function noteGroupsFromSelections(
  variantTypes: VariantType[],
  selections: VariantSelectionMap,
  locale: string,
): OptionValueNoteGroup[] {
  return variantTypes
    .filter((type) => (selections[type.id] ?? []).length > 0)
    .map((type) => ({
      id: type.id,
      typeName: localize(type.name, locale),
      rows: type.values
        .filter((value) => (selections[type.id] ?? []).includes(value.id))
        .map((value) => ({ key: value.id, label: localize(value.value, locale) })),
    }));
}

export function noteGroupsFromProduct(product: Product, locale: string): OptionValueNoteGroup[] {
  const groups = new Map<string, OptionValueNoteGroup>();

  for (const variant of product.variants) {
    for (const value of variant.values) {
      const type = product.variantTypes.find((candidate) => candidate.id === value.variantTypeId);
      const group = groups.get(value.variantTypeId) ?? {
        id: value.variantTypeId,
        typeName: type ? localize(type.name, locale) : "",
        rows: [],
      };
      if (!group.rows.some((row) => row.key === value.id)) {
        group.rows.push({ key: value.id, label: localize(value.value, locale) });
      }
      groups.set(value.variantTypeId, group);
    }
  }

  return [...groups.values()];
}
