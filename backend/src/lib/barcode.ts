import { prisma } from "@/lib/prisma";
import { BARCODE_MAX_ATTEMPTS, BARCODE_PREFIX, BARCODE_RANDOM_DIGITS } from "@/constants";

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
  for (let i = 0; i < BARCODE_RANDOM_DIGITS; i++) {
    body += Math.floor(Math.random() * 10);
  }
  const twelve = BARCODE_PREFIX + body;
  return `${twelve}${checkDigit(twelve)}`;
}

// Barcodes are unique across BOTH products and variants (one shared
// namespace), per CLAUDE.md rule 13.
export async function generateUniqueBarcode(): Promise<string> {
  for (let attempt = 0; attempt < BARCODE_MAX_ATTEMPTS; attempt++) {
    const candidate = randomCandidate();
    const [existingProduct, existingVariant] = await Promise.all([
      prisma.product.findUnique({ where: { barcode: candidate }, select: { id: true } }),
      prisma.variant.findUnique({ where: { barcode: candidate }, select: { id: true } }),
    ]);
    if (!existingProduct && !existingVariant) return candidate;
  }
  throw new Error("Failed to generate a unique EAN-13 barcode after multiple attempts");
}
