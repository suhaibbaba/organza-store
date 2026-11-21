import type { BarcodeSource } from "@store/shared/types/product";

export type { BarcodeSource };

// The normalized barcode half of a body; `barcode` is read only when barcodeSource is SUPPLIER.
export interface BarcodeInput {
  barcodeSource?: BarcodeSource;
  barcode?: string;
}

// What a row holds now; `generatedBarcode` is ours, parked while a supplier code is in use.
export interface BarcodeState {
  barcode: string | null;
  barcodeSource: BarcodeSource;
  generatedBarcode: string | null;
}

// The columns to write; null when the barcode is untouched.
export type BarcodePatch = BarcodeState;

// A resolved edit plus whether the code was never printed, which puts the product back in the label queue.
export interface BarcodeUpdate {
  data: BarcodePatch;
  mintedFresh: boolean;
}

// Which row is asking, so its own code is no clash.
export interface BarcodeOwner {
  productId?: string;
  variantId?: string;
}

// What a duplicate clashed with, so the screen can name it ("already used by ORG-00042-3").
export interface BarcodeConflict {
  kind: "product" | "variant";
  sku: string | null;
  productId: string;
  variantId: string | null;
  // The holder is soft-deleted (rule 4): it still owns the code but is out of the catalogue.
  deleted: boolean;
}
