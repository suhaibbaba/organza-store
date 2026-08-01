// GS1 "restricted circulation" prefix range (200-299), safe for in-store use
// without registering with GS1 — appropriate since these barcodes are
// system-generated, not real GS1-issued product codes.
export const BARCODE_PREFIX = "200";
export const BARCODE_RANDOM_DIGITS = 9; // 3 (prefix) + 9 (random) + 1 (check digit) = 13
export const BARCODE_MAX_ATTEMPTS = 20;
