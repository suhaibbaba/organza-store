import type { ReactNode } from "react";
import type { ProductPrintState, ProductSummary } from "@store/shared/types/product";
import type { Pagination } from "@store/shared/types/common";
import type { LabelPrintMode } from "@store/shared/types/setting";

// The products list filters minus price range and sort.
export interface LabelListFilters {
  q: string;
  categoryId: string | null;
  printState: ProductPrintState;
  page: number;
  pageSize: number;
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
  // The variant's own photo, else the product's (a numbered shawl's carries its numbers).
  thumbnailUrl: string | null;
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

export interface LabelFiltersValue {
  categoryId: string | null;
}

export interface LabelCategoryFilterProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export interface LabelFiltersProps {
  value: LabelFiltersValue;
  onApply: (value: LabelFiltersValue) => void;
}

export interface LabelFilterChipsProps {
  value: LabelFiltersValue;
  onChange: (value: LabelFiltersValue) => void;
}

export interface LabelTableProps {
  products: readonly ProductSummary[];
  meta: Pagination | null;
  isLoading: boolean;
  isRefreshing: boolean;
  selectedIds: readonly string[];
  onToggle: (productId: string) => void;
  onToggleAll: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface LabelSelectBarProps {
  count: number;
  onClear: () => void;
  onNext: () => void;
}

export interface LabelCopiesListProps {
  lines: readonly LabelLine[];
  copies: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export interface LabelCopiesRowProps {
  line: LabelLine;
  value: string;
  onChange: (key: string, value: string) => void;
}

export interface LabelSheetCardProps {
  geometry: LabelGeometry;
  totalLabels: number;
  canPrint: boolean;
  onPrint: () => void;
  children?: ReactNode;
}

export interface LabelPrintBarProps {
  totalLabels: number;
  canPrint: boolean;
  onPrint: () => void;
}

export interface LabelPrintedModalProps {
  open: boolean;
  isPending: boolean;
  errorCode: string | null;
  onConfirm: () => void;
  onClose: () => void;
}
