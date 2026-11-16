import {
  BARCODE_MAX_LENGTH,
  BARCODE_MIN_LENGTH,
  BARCODE_PATTERN,
} from "@/constants/barcode";
import { toLatinDigits } from "@/lib/keyboard";

// One normalizer for a typed-or-scanned supplier code, shared by the forms
// that collect it and the API that stores it — so what the screen shows is
// character-for-character what a scan at the counter will later match.
//
// Whitespace goes entirely, rather than being collapsed: a barcode has none,
// and every way a space gets into the field is an accident (a trailing space
// from a paste, a stray Space key mid-burst, a supplier's tag printed with
// the code split into groups). Keeping one would make the code unscannable
// while looking correct on screen.
//
// Digits are folded to ASCII for the same reason the POS does it on the way
// in: the shop types on an Arabic keyboard, whose digit row sends ٤ rather
// than 4, and every code stored anywhere in the catalogue is ASCII.
export function normalizeBarcode(raw: string): string {
  return toLatinDigits(raw).replace(/\s+/gu, "");
}

// Whether a normalized code is one we will store. Format only — see
// constants/barcode.ts for why a check digit is deliberately not required.
export function isValidBarcode(code: string): boolean {
  return (
    code.length >= BARCODE_MIN_LENGTH &&
    code.length <= BARCODE_MAX_LENGTH &&
    BARCODE_PATTERN.test(code)
  );
}
