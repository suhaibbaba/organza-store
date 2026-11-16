import { toLatinDigits } from './search.js';

export const BARCODE_MIN_LENGTH = 4;
export const BARCODE_MAX_LENGTH = 48;
const BARCODE_PATTERN = /^[0-9A-Za-z][0-9A-Za-z\-./+%$]*$/;

/** Scanners under an Arabic layout can send Arabic-Indic digits; spaces are never part of a code. */
export function normalizeBarcode(raw: string): string {
  return toLatinDigits(raw).replace(/\s+/g, '');
}

export function isValidBarcode(code: string): boolean {
  return (
    code.length >= BARCODE_MIN_LENGTH &&
    code.length <= BARCODE_MAX_LENGTH &&
    BARCODE_PATTERN.test(code)
  );
}

/** EAN-13 check digit for 12 digits. */
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** In-store EAN-13 in the GS1 restricted-circulation range (prefix 200), as today. */
export const GENERATED_BARCODE_PREFIX = '200';

export function skuFor(productNumber: number, itemNumber?: number): string {
  const base = `ORG-${String(productNumber).padStart(5, '0')}`;
  return itemNumber === undefined ? base : `${base}-${itemNumber}`;
}
