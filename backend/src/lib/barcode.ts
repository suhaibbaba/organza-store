import { prisma } from "./prisma";

// GS1 "restricted circulation" prefix range (200-299), safe for in-store use
// without registering with GS1 — appropriate since these barcodes are
// system-generated, not real GS1-issued product codes.
const BARCODE_PREFIX = "200";
const RANDOM_DIGITS = 9; // 3 (prefix) + 9 (random) + 1 (check digit) = 13
const MAX_ATTEMPTS = 20;

function checkDigit(twelveDigits: string): number {
  let sum = 0;
  for (let i = 0; i < twelveDigits.length; i++) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function randomCandidate(): string {
  let body = "";
  for (let i = 0; i < RANDOM_DIGITS; i++) {
    body += Math.floor(Math.random() * 10);
  }
  const twelve = BARCODE_PREFIX + body;
  return `${twelve}${checkDigit(twelve)}`;
}

// Barcodes are unique across BOTH products and variants (one shared
// namespace), per CLAUDE.md rule 13.
export async function generateUniqueBarcode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomCandidate();
    const [existingProduct, existingVariant] = await Promise.all([
      prisma.product.findUnique({ where: { barcode: candidate }, select: { id: true } }),
      prisma.variant.findUnique({ where: { barcode: candidate }, select: { id: true } }),
    ]);
    if (!existingProduct && !existingVariant) return candidate;
  }
  throw new Error("Failed to generate a unique EAN-13 barcode after multiple attempts");
}
