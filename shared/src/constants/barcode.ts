/* ---------------------------------------------------------------------------
 * Barcodes: ours, or the supplier's
 *
 * CLAUDE.md rule 13: every product and variant gets a generated, unique
 * EAN-13, and that stays the default — nothing changes for a piece that
 * arrives with no code on it.
 *
 * But many garments arrive already barcoded. Printing our own label over a
 * perfectly good one wastes a label and a minute per piece, so the shop can
 * keep the supplier's code instead. Which of the two a piece uses is STORED
 * (Product.barcodeSource / Variant.barcodeSource), never inferred from what
 * the code happens to look like: a supplier's EAN-13 is indistinguishable
 * from ours, and guessing wrong is what decides whether a label is owed.
 * ------------------------------------------------------------------------ */

export const BARCODE_SOURCES = ["GENERATED", "SUPPLIER"] as const;

export const BARCODE_SOURCE = {
  // Ours: an EAN-13 this system minted, printed on a label we stick on.
  GENERATED: "GENERATED",
  // The supplier's: already printed on the garment, typed or scanned in.
  SUPPLIER: "SUPPLIER",
} as const;

/* ---------------------------------------------------------------------------
 * What counts as a code we will accept
 *
 * A supplier code is whatever is physically printed on the tag, so the rule
 * has to be wide enough for the formats that actually turn up — EAN-13 and
 * EAN-8, UPC-A (12 digits), and the free-form Code 128 / Code 39 strings that
 * small suppliers print — while still refusing something that is plainly not
 * a barcode (an empty field, a sentence, a name with Arabic letters in it).
 *
 * Deliberately NOT check-digit validated: a code that a scanner reads and a
 * supplier prints is a valid code by definition, and rejecting it because its
 * check digit disagrees with EAN's rules would leave the shop unable to enter
 * a tag it is holding in its hand.
 * ------------------------------------------------------------------------ */

// EAN-8 is the shortest real format at 8 digits; 4 leaves room for the short
// in-house codes some suppliers use without accepting a stray keystroke.
export const BARCODE_MIN_LENGTH = 4;
// Code 128 in practice never runs past this, and a longer "code" is a paste
// accident.
export const BARCODE_MAX_LENGTH = 48;

// ASCII only, starting on a letter or a digit. The punctuation is Code 39's
// full character set (- . / + % $), which is what a label printer falls back
// to; whitespace is absent on purpose — it is stripped before this is applied
// (see lib/barcode.ts).
export const BARCODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z\-.\/+%$]*$/;
