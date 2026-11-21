import type { I18n } from "@/types/common";
import type { ProductOptionValueNote } from "@/types/product";
import type { Variant, VariantOptionValueRef } from "@/types/variant";

// Which notes a variant carries, in order (spec.md "Notes on a product's options"), defined once for every screen.

export interface VariantValueNote {
  /** The option value the note belongs to — its id is a stable React key. */
  valueId: string;
  variantTypeId: string;
  /** The value itself ("S", "أخضر", "4"), for labelling the note. */
  value: I18n;
  note: I18n;
}

/** One variant's notes in value order; empty, never a placeholder, when none were written. */
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

/** A typed note trimmed with blank languages dropped; null when nothing is left, so blank is stored as no row. */
export function normalizeOptionValueNote(note: I18n | null | undefined): I18n | null {
  if (!note) {
    return null;
  }
  const entries = Object.entries(note)
    .map(([language, text]) => [language, (text ?? "").trim()] as const)
    .filter(([, text]) => text.length > 0);
  return entries.length > 0 ? (Object.fromEntries(entries) as I18n) : null;
}

/** The product's notes as a lookup, for the form that edits them. */
export function noteByOptionValueId(notes: ProductOptionValueNote[]): Map<string, I18n> {
  return new Map(notes.map((entry) => [entry.optionValueId, entry.note]));
}
