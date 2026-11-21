import { BARCODE_MAX_LENGTH, BARCODE_MIN_LENGTH, BARCODE_PATTERN } from "@/constants/barcode";
import { toLatinDigits } from "@/lib/keyboard";

// One normalizer for supplier codes: whitespace removed (it makes a code unscannable) and Arabic digits folded to ASCII.
export function normalizeBarcode(raw: string): string {
  return toLatinDigits(raw).replace(/\s+/gu, "");
}

// Format only; constants/barcode.ts explains why no check digit is required.
export function isValidBarcode(code: string): boolean {
  return code.length >= BARCODE_MIN_LENGTH && code.length <= BARCODE_MAX_LENGTH && BARCODE_PATTERN.test(code);
}
