import type { OptionValueNoteInput } from "@organza/shared/schemas/product";
import type { I18n } from "@organza/shared/types/common";
import type { Product } from "@organza/shared/types/product";
import type { VariantType } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import type { I18nFormValue, OptionValueNoteGroup, VariantSelectionMap } from "@/types/productForm";

// The product form's working shape for the notes it writes against option
// values (spec.md "Notes on a product's options"). Notes are edited as plain
// strings per language, like the name and the description, and turned into
// the API's shape only at save time.
//
// Rows are keyed by a STRING the caller chooses rather than by the option
// value id: for an ordinary product that key is the value id, but a numbered
// shawl writes notes against numbers it has only just placed, whose global
// value does not exist until the save resolves it. Keeping the key opaque is
// what lets one editor serve both.

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
  text: string
): OptionValueNoteMap {
  return { ...notes, [key]: { ...noteFor(notes, key), [language]: text } };
}

export function countNotes(notes: OptionValueNoteMap): number {
  return Object.values(notes).filter((value) => !isBlank(value)).length;
}

/**
 * Only what changed, in the API's shape — a note that was cleared is sent as
 * an explicit `null` (which removes it), and one that was never touched is
 * not sent at all, so a save can never overwrite a note this screen didn't
 * know about.
 *
 * `resolveOptionValueId` turns a row key into the option value the note
 * belongs to; a row whose value does not exist yet (a number placed in this
 * same save, before it was resolved) is skipped rather than guessed at.
 */
export function diffOptionValueNotes(
  initial: OptionValueNoteMap,
  current: OptionValueNoteMap,
  resolveOptionValueId: (key: string) => string | null = (key) => key
): OptionValueNoteInput[] {
  const changes: OptionValueNoteInput[] = [];

  for (const key of new Set([...Object.keys(initial), ...Object.keys(current)])) {
    const before = noteFor(initial, key);
    const after = noteFor(current, key);
    const sameInEveryLanguage = (["ar", "en", "he"] as const).every(
      (language) => before[language].trim() === after[language].trim()
    );
    if (sameInEveryLanguage) continue;

    const optionValueId = resolveOptionValueId(key);
    if (!optionValueId) continue;

    changes.push({
      optionValueId,
      note: isBlank(after)
        ? null
        : Object.fromEntries(
            (["ar", "en", "he"] as const)
              .map((language) => [language, after[language].trim()] as const)
              .filter(([, text]) => text.length > 0)
          ),
    });
  }

  return changes;
}

/**
 * The values a note may be written against while a product is being CREATED:
 * whatever has just been ticked in the option picker.
 */
export function noteGroupsFromSelections(
  variantTypes: VariantType[],
  selections: VariantSelectionMap,
  locale: string
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

/**
 * The values a note may be written against on a product that already exists:
 * every value its variants actually use, each listed once, grouped by the
 * type it belongs to and in the order the variants present them.
 */
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
