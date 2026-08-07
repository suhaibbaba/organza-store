import type { BarcodeSource } from "@shared/types/product";

export type { BarcodeSource };

// The barcode half of a create/update body, once Zod has normalized it
// (shared/schemas/product.ts). `barcode` is read ONLY when `barcodeSource` is
// SUPPLIER — a code with no source attached is never taken as a decision,
// because which of the two a piece uses is stored, not inferred.
export interface BarcodeInput {
  barcodeSource?: BarcodeSource;
  barcode?: string;
}

// What a product or variant row currently holds. `generatedBarcode` is the
// code we minted, parked while a supplier code is in use.
export interface BarcodeState {
  barcode: string | null;
  barcodeSource: BarcodeSource;
  generatedBarcode: string | null;
}

// The columns to write. Null means "nothing about the barcode changed" — the
// callers merge this into a larger update, so an untouched barcode must not
// appear in it at all.
export type BarcodePatch = BarcodeState;

// Which row is asking, so the uniqueness check can ignore the code the row
// already owns (re-saving a form must not clash with itself).
export interface BarcodeOwner {
  productId?: string;
  variantId?: string;
}

// What a rejected duplicate clashed with, carried in the error's `details` so
// the screen can name it: "already used by ORG-00042-3". Without it "this
// barcode is already used" is unanswerable — the user cannot tell whether
// they scanned the wrong tag or the right tag onto the wrong piece.
export interface BarcodeConflict {
  kind: "product" | "variant";
  sku: string | null;
  productId: string;
  variantId: string | null;
  // The piece holding the code has been soft-deleted (CLAUDE.md rule 4), so
  // it still owns the code but is nowhere to be found in the catalogue.
  deleted: boolean;
}
