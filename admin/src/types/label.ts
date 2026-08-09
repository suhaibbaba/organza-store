import type { ProductPrintState } from "@shared/types/product";
import type { LabelPrintMode } from "@shared/types/setting";

// Client-side filter state for the barcode-labels screen. Mirrors the
// products list filters it reuses, minus the ones that make no sense when
// picking what to print (price range, sort).
export interface LabelListFilters {
  q: string;
  categoryId: string | null;
  printState: ProductPrintState;
  page: number;
}

// One design in the print run — a product or one of its variants — plus how
// many copies of it to print. Which of the three shapes a product takes is
// decided in lib/labels.ts.
export interface LabelLine {
  // Stable identity of the line: `<productId>:<variantId | "product">`.
  key: string;
  productId: string;
  variantId: string | null;
  // Product name, localized for display and for the sticker itself.
  name: string;
  // Variant label ("أحمر / M"); null for a simple product or a numbered
  // shawl's parent.
  subtitle: string | null;
  // What the barcode encodes: the generated barcode, falling back to the SKU
  // when a variant has none. Null when there is nothing to encode at all.
  code: string | null;
  // Copies proposed before the user edits anything: the piece's stock, so a
  // shop with three of something gets three stickers — and zero for a piece
  // that already carries the supplier's own barcode, which needs no label of
  // ours at all. Only ever a proposal: typing a count over it prints anyway.
  suggestedCopies: number;
  // What the proposal was drawn from, before the field's own ceiling was
  // applied — the variant's stock, or the product's for a simple one. Null
  // when the count was never a stock figure at all (a numbered shawl, whose
  // count is typed by hand). Carried separately so the screen can SAY that a
  // stock of 1200 was proposed as 999, rather than quietly handing back a
  // smaller number than the shop has pieces.
  stock: number | null;
  // The code on this line is the supplier's, printed on the garment before it
  // reached the shop (shared/constants/barcode.ts). The line stays on the list,
  // marked, rather than disappearing: printing our own label over it has to
  // remain possible.
  supplierBarcode: boolean;
  // Numbered shawls print the PARENT only (spec.md: one photo, numbers drawn
  // on it), so the count can't come from stock — it is entered by hand.
  isNumbered: boolean;
}

// One physical sticker. A line with 3 copies expands into 3 of these.
export interface LabelPrintItem {
  key: string;
  name: string;
  subtitle: string | null;
  code: string | null;
}

// Everything the sheet needs to lay itself out, read from the Setting
// singleton (CLAUDE.md rule 14 — never hard-coded).
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
