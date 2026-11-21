import { BARCODE_SOURCE } from "@store/shared/constants/barcode";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { BARCODE_MAX_ATTEMPTS, BARCODE_PREFIX, BARCODE_RANDOM_DIGITS, ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types/changeRequest";
import type { BarcodeInput, BarcodeOwner, BarcodePatch, BarcodeState, BarcodeUpdate } from "@/types/barcode";

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

// Barcodes are unique across products and variants (rule 13); takes the transaction client to see its own uncommitted rows.
export async function generateUniqueBarcode(client: DbClient = prisma): Promise<string> {
  for (let attempt = 0; attempt < BARCODE_MAX_ATTEMPTS; attempt++) {
    const candidate = randomCandidate();
    if (await isCodeUnused(candidate, {}, client)) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique EAN-13 barcode after multiple attempts");
}

// generatedBarcode counts too: a parked code is still on a physical label, so reusing it would sell the wrong item.
async function findBarcodeHolders(code: string, owner: BarcodeOwner, client: DbClient) {
  const productWhere = { OR: [{ barcode: code }, { generatedBarcode: code }] };
  const variantWhere = { OR: [{ barcode: code }, { generatedBarcode: code }] };
  return Promise.all([
    client.product.findFirst({
      where: owner.productId ? { AND: [productWhere, { id: { not: owner.productId } }] } : productWhere,
      select: { id: true, sku: true, deletedAt: true },
    }),
    client.variant.findFirst({
      where: owner.variantId ? { AND: [variantWhere, { id: { not: owner.variantId } }] } : variantWhere,
      select: { id: true, sku: true, productId: true, product: { select: { deletedAt: true } } },
    }),
  ]);
}

async function isCodeUnused(code: string, owner: BarcodeOwner, client: DbClient): Promise<boolean> {
  const [product, variant] = await findBarcodeHolders(code, owner, client);
  return !product && !variant;
}

// Supplier barcodes: a garment that arrived barcoded keeps its printed code (shared/constants/barcode.ts).

// Free across both tables (one namespace), excluding the row asking; the unique indexes stay the backstop for races.
export async function assertBarcodeAvailable(
  code: string,
  owner: BarcodeOwner = {},
  client: DbClient = prisma,
): Promise<void> {
  const [product, variant] = await findBarcodeHolders(code, owner, client);

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

// A new piece's barcode: nothing given means ours, minted here.
export async function resolveNewBarcode(input: BarcodeInput, client: DbClient = prisma): Promise<BarcodePatch> {
  if (input.barcodeSource === BARCODE_SOURCE.SUPPLIER && input.barcode) {
    await assertBarcodeAvailable(input.barcode, {}, client);
    // No generated code is minted alongside: no label of ours exists yet, so switching to GENERATED mints one then.
    return { barcode: input.barcode, barcodeSource: BARCODE_SOURCE.SUPPLIER, generatedBarcode: null };
  }

  return {
    barcode: await generateUniqueBarcode(client),
    barcodeSource: BARCODE_SOURCE.GENERATED,
    generatedBarcode: null,
  };
}

// An edit: null when the barcode is untouched; to SUPPLIER parks ours, to GENERATED brings the parked code back.
export async function resolveBarcodeChange(
  existing: BarcodeState,
  input: BarcodeInput,
  owner: BarcodeOwner,
  client: DbClient = prisma,
): Promise<BarcodeUpdate | null> {
  if (!input.barcodeSource) {
    return null;
  }

  if (input.barcodeSource === BARCODE_SOURCE.SUPPLIER) {
    const code = input.barcode;
    // Guaranteed by the schema's refinement; this keeps the invariant local.
    if (!code) {
      throw new AppError(400, ERROR_CODES.BARCODE_REQUIRED);
    }
    if (existing.barcodeSource === BARCODE_SOURCE.SUPPLIER && existing.barcode === code) {
      return null;
    }

    await assertBarcodeAvailable(code, owner, client);
    return {
      data: {
        barcode: code,
        barcodeSource: BARCODE_SOURCE.SUPPLIER,
        // Parked on the way out, and left alone when one supplier code replaces another.
        generatedBarcode:
          existing.barcodeSource === BARCODE_SOURCE.GENERATED ? existing.barcode : existing.generatedBarcode,
      },
      mintedFresh: false,
    };
  }

  if (existing.barcodeSource === BARCODE_SOURCE.GENERATED) {
    return null;
  }

  const parked = existing.generatedBarcode;
  // Parked codes are reserved, so this is normally a formality; older data may have no code of ours to restore.
  const restorable = parked !== null && (await isCodeUnused(parked, owner, client));
  return {
    data: {
      barcode: restorable ? parked : await generateUniqueBarcode(client),
      barcodeSource: BARCODE_SOURCE.GENERATED,
      generatedBarcode: null,
    },
    // A code nobody has printed: the piece's label says something else, so it goes back in the print queue.
    mintedFresh: !restorable,
  };
}
