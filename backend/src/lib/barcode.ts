import { BARCODE_SOURCE } from "@shared/constants/barcode";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { BARCODE_MAX_ATTEMPTS, BARCODE_PREFIX, BARCODE_RANDOM_DIGITS, ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types/changeRequest";
import type { BarcodeInput, BarcodeOwner, BarcodePatch, BarcodeState } from "@/types/barcode";

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
//
// Takes the client so a caller generating several inside one transaction
// (a whole variant set at once) checks against the rows that same transaction
// has already written, rather than against the last committed state.
export async function generateUniqueBarcode(client: DbClient = prisma): Promise<string> {
  for (let attempt = 0; attempt < BARCODE_MAX_ATTEMPTS; attempt++) {
    const candidate = randomCandidate();
    const [existingProduct, existingVariant] = await Promise.all([
      client.product.findUnique({ where: { barcode: candidate }, select: { id: true } }),
      client.variant.findUnique({ where: { barcode: candidate }, select: { id: true } }),
    ]);
    if (!existingProduct && !existingVariant) return candidate;
  }
  throw new Error("Failed to generate a unique EAN-13 barcode after multiple attempts");
}

/* ---------------------------------------------------------------------------
 * Supplier barcodes
 *
 * Auto-generation stays the default (CLAUDE.md rule 13). What follows is the
 * other case: a garment that arrived already barcoded, whose printed code the
 * shop keeps rather than covering with a label of its own. See
 * shared/constants/barcode.ts.
 * ------------------------------------------------------------------------ */

// Is this code free? Checked across BOTH tables, because barcodes share one
// namespace — a variant's code colliding with a product's would make one scan
// resolve to two different things, and the POS answers a scan with whichever
// it finds first. The row asking is excluded, so re-saving a form with the
// code it already has is not a clash with itself.
//
// The unique indexes are still the backstop (two saves racing each other end
// as a P2002, which the error handler maps to the same code). This exists to
// name the conflict while we can still see it, which a constraint violation
// cannot do.
//
// Soft-deleted products are NOT excluded: deletion here only sets `deletedAt`
// (CLAUDE.md rule 4), so those rows still hold their codes and the unique
// index still enforces it. Answering "free" for one and then failing on the
// constraint would turn a clear refusal into an unexplained 409, so the
// conflict is reported — `deleted` says so, since the piece it names is not
// one the user will find on the shelf.
export async function assertBarcodeAvailable(
  code: string,
  owner: BarcodeOwner = {},
  client: DbClient = prisma
): Promise<void> {
  const [product, variant] = await Promise.all([
    client.product.findFirst({
      where: { barcode: code, ...(owner.productId ? { id: { not: owner.productId } } : {}) },
      select: { id: true, sku: true, deletedAt: true },
    }),
    client.variant.findFirst({
      where: { barcode: code, ...(owner.variantId ? { id: { not: owner.variantId } } : {}) },
      select: { id: true, sku: true, productId: true, product: { select: { deletedAt: true } } },
    }),
  ]);

  if (product) {
    throw new AppError(409, ERROR_CODES.BARCODE_DUPLICATE, {
      kind: "product",
      sku: product.sku,
      productId: product.id,
      variantId: null,
      deleted: product.deletedAt !== null,
    });
  }
  if (variant) {
    throw new AppError(409, ERROR_CODES.BARCODE_DUPLICATE, {
      kind: "variant",
      sku: variant.sku,
      productId: variant.productId,
      variantId: variant.id,
      deleted: variant.product.deletedAt !== null,
    });
  }
}

// A brand-new piece's barcode. Nothing given ⇒ ours, minted here, which is
// what every product got before supplier codes existed.
export async function resolveNewBarcode(
  input: BarcodeInput,
  client: DbClient = prisma
): Promise<BarcodePatch> {
  if (input.barcodeSource === BARCODE_SOURCE.SUPPLIER && input.barcode) {
    await assertBarcodeAvailable(input.barcode, {}, client);
    // No generated code is minted alongside it: there is no label of ours in
    // circulation to protect, so switching to GENERATED later mints one then.
    return { barcode: input.barcode, barcodeSource: BARCODE_SOURCE.SUPPLIER, generatedBarcode: null };
  }

  return {
    barcode: await generateUniqueBarcode(client),
    barcodeSource: BARCODE_SOURCE.GENERATED,
    generatedBarcode: null,
  };
}

// An edit. Returns null when the request says nothing about the barcode, or
// says exactly what the row already holds — the callers merge the result into
// a bigger update, and an untouched barcode must not appear in it.
//
// Both directions are always available (that is the point of the toggle):
//   → SUPPLIER: the typed/scanned code replaces ours, and ours is parked.
//   → GENERATED: the parked code comes BACK, so a label already printed and
//     stuck on the piece keeps working. Only if that code has since been
//     taken (or was never minted) is a fresh one generated.
export async function resolveBarcodeChange(
  existing: BarcodeState,
  input: BarcodeInput,
  owner: BarcodeOwner,
  client: DbClient = prisma
): Promise<BarcodePatch | null> {
  if (!input.barcodeSource) return null;

  if (input.barcodeSource === BARCODE_SOURCE.SUPPLIER) {
    const code = input.barcode;
    // Guaranteed by the schema's refinement; this keeps the invariant local.
    if (!code) throw new AppError(400, ERROR_CODES.BARCODE_REQUIRED);
    if (existing.barcodeSource === BARCODE_SOURCE.SUPPLIER && existing.barcode === code) return null;

    await assertBarcodeAvailable(code, owner, client);
    return {
      barcode: code,
      barcodeSource: BARCODE_SOURCE.SUPPLIER,
      // Parked on the way out, and left alone when one supplier code simply
      // replaces another — the code to restore is still the one WE minted.
      generatedBarcode:
        existing.barcodeSource === BARCODE_SOURCE.GENERATED ? existing.barcode : existing.generatedBarcode,
    };
  }

  if (existing.barcodeSource === BARCODE_SOURCE.GENERATED) return null;

  const parked = existing.generatedBarcode;
  const restorable = parked !== null && (await isBarcodeFree(parked, owner, client));
  return {
    barcode: restorable ? parked : await generateUniqueBarcode(client),
    barcodeSource: BARCODE_SOURCE.GENERATED,
    generatedBarcode: null,
  };
}

async function isBarcodeFree(code: string, owner: BarcodeOwner, client: DbClient): Promise<boolean> {
  try {
    await assertBarcodeAvailable(code, owner, client);
    return true;
  } catch {
    // Someone else holds it now. Not an error to report — the caller simply
    // mints a fresh code instead of failing an edit over it.
    return false;
  }
}
