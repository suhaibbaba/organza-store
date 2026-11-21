import type { ProductPrintState } from "@store/shared/types/product";
import type { LabelPrintMode } from "@store/shared/types/setting";

// The products list filters minus price range and sort.
export interface LabelListFilters {
  q: string;
  categoryId: string | null;
  printState: ProductPrintState;
  page: number;
}

export interface LabelLine {
  // Stable identity of the line: `<productId>:<variantId | "product">`.
  key: string;
  productId: string;
  variantId: string | null;
  // Product name, localized for display and for the sticker itself.
  name: string;
  // Null for a simple product or a numbered shawl's parent.
  subtitle: string | null;
  // The barcode, else the SKU; null when there is nothing to encode.
  code: string | null;
  // The piece's stock, or zero for a supplier-coded piece; only a proposal.
  suggestedCopies: number;
  // Before the field's ceiling, so the screen can say a stock of 1200 was proposed as 999; null for numbered shawls.
  stock: number | null;
  // Kept on the list, marked, so our own label can still be printed over it.
  supplierBarcode: boolean;
  // Printed as the parent only, so the count is typed by hand.
  isNumbered: boolean;
}

// One physical sticker. A line with 3 copies expands into 3 of these.
export interface LabelPrintItem {
  key: string;
  name: string;
  subtitle: string | null;
  code: string | null;
}

// From the Setting singleton (rule 14).
export interface LabelGeometry {
  printMode: LabelPrintMode;
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  pageMarginTopMm: number;
  pageMarginRightMm: number;
  pageMarginBottomMm: number;
  pageMarginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
}

// Two steps, not a wizard: pick the products, then set counts and print.
export type LabelStep = "select" | "prepare";
