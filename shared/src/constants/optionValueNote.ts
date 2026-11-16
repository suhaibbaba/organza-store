// Per-product notes on an option value (spec.md "Notes on a product's
// options").
//
// "S" means something different on a pair of trousers than on an abaya, so the
// shop writes "طول البنطلون ٩٥ سم" against THAT product's own S. The note
// therefore belongs to the product's use of the value, never to the global
// value itself — the same "S" on the next product is untouched.

/**
 * How long one language of a note may be. Short on purpose: this is a
 * measurement or a word of warning read on a picker tile between two
 * customers, not a second description. Long enough for "طول البنطلون ٩٥ سم"
 * several times over, short enough that a tile stays scannable.
 */
export const OPTION_VALUE_NOTE_MAX_LENGTH = 120;
