import type { I18n } from "@/types/common";
import type { ProductOptionValueNote } from "@/types/product";
import type { Variant, VariantOptionValueRef } from "@/types/variant";

// Which notes a variant carries, and in what order (spec.md "Notes on a
// product's options").
//
// One definition for every screen that draws them — the POS picker, the
// product detail page and, when it is built, the storefront's variant
// selector. Colours, sizes and numbers are all option values, so none of them
// can end up with a different answer to "does this have a note", which is the
// whole reason this is not a `.filter()` written out three times.

export interface VariantValueNote {
  /** The option value the note belongs to — its id is a stable React key. */
  valueId: string;
  variantTypeId: string;
  /** The value itself ("S", "أخضر", "4"), for labelling the note. */
  value: I18n;
  note: I18n;
}

/**
 * The notes on one variant, in the variant's own value order, with the
 * value each belongs to. Empty — never a placeholder — when nothing was
 * written, so a screen renders nothing at all and no gap is left behind.
 */
export function variantValueNotes(variant: Pick<Variant, "values">): VariantValueNote[] {
  return variant.values
    .filter((value): value is VariantOptionValueRef & { note: I18n } => Boolean(value.note))
    .map((value) => ({
      valueId: value.id,
      variantTypeId: value.variantTypeId,
      value: value.value,
      note: value.note,
    }));
}

/**
 * What actually gets stored for a note somebody typed: trimmed, with every
 * blank language dropped — and `null` when nothing is left, because blank in
 * every language is not a note, it is the ABSENCE of one. Stored that way (no
 * row at all) so "does this value have a note" is one question with one
 * answer, rather than a row full of empty strings every screen has to test.
 */
export function normalizeOptionValueNote(note: I18n | null | undefined): I18n | null {
  if (!note) return null;
  const entries = Object.entries(note)
    .map(([language, text]) => [language, (text ?? "").trim()] as const)
    .filter(([, text]) => text.length > 0);
  return entries.length > 0 ? (Object.fromEntries(entries) as I18n) : null;
}

/** The product's notes as a lookup, for the form that edits them. */
export function noteByOptionValueId(notes: ProductOptionValueNote[]): Map<string, I18n> {
  return new Map(notes.map((entry) => [entry.optionValueId, entry.note]));
}
