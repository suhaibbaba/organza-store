import { BARCODE_SOURCE } from "@shared/constants/barcode";
import type { Product } from "@shared/types/product";
import type { Setting } from "@shared/types/setting";
import { localize } from "@/lib/i18n-content";
import { isNonNegativeIntegerString } from "@/lib/validation/numeric";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  CSS_PX_PER_INCH,
  DEFAULT_LABEL_FILTERS,
  LABEL_COPIES_MAX,
  MM_PER_INCH,
} from "@/constants/labels";
import { DEFAULT_PRODUCT_FILTERS } from "@/constants/products";
import type { LabelGeometry, LabelLine, LabelListFilters, LabelPrintItem } from "@/types/label";
import type { ProductListFilters } from "@/types/product";

// The labels screen picks from the same catalogue as the products screen, so
// it reuses that list endpoint (and its cache) rather than growing a second
// one — it just fixes the sort and drops the filters that don't apply.
export function toProductListFilters(filters: LabelListFilters): ProductListFilters {
  return {
    ...DEFAULT_PRODUCT_FILTERS,
    q: filters.q,
    categoryId: filters.categoryId,
    printState: filters.printState,
    page: filters.page,
  };
}

export function hasActiveLabelFilters(filters: LabelListFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    Boolean(filters.categoryId) ||
    filters.printState !== DEFAULT_LABEL_FILTERS.printState
  );
}

// A numbered shawl (spec.md "Numbered shawls") — one photo with the numbers
// drawn on it — says so itself, on the flag chosen when it was added.
export function isNumberedProduct(product: Pick<Product, "isNumbered">): boolean {
  return product.isNumbered;
}

// What to print for one product, in the three shapes the catalogue takes:
//
//   simple product   — one design, copies = its stock
//   ordinary variants— one design per variant, copies = that variant's stock
//                      (colour/size labels have to name which piece they're on)
//   numbered shawl   — the PARENT only. Its numbers live on the photo, not on
//                      separate tags, so there is nothing per-number to stick;
//                      the count is whatever the shop wants and is typed in.
//
// A line whose code is the supplier's own needs no sticker: the garment came
// with one printed on it. Those lines are kept but proposed at zero copies and
// marked on screen — the state is shown, never faked by pretending the label
// was printed (see the products list's `printState` filter, which excludes the
// same pieces by source). Printing one anyway is a typed count away.
export function buildLabelLines(product: Product, locale: string): LabelLine[] {
  const name = localize(product.name, locale);
  // The suggestion can't propose more than the field itself accepts, or the
  // number on screen would stop matching the number being counted.
  const suggest = (stock: number) => Math.min(Math.max(stock, 0), LABEL_COPIES_MAX);
  // A supplier code on the PARENT covers every variant under it: that is the
  // shared-code case — one tag for all sizes — so nothing per-variant is owed
  // either.
  const parentIsSupplier = product.barcodeSource === BARCODE_SOURCE.SUPPLIER;

  if (isNumberedProduct(product)) {
    return [
      {
        key: `${product.id}:product`,
        productId: product.id,
        variantId: null,
        name,
        subtitle: null,
        code: product.barcode,
        suggestedCopies: parentIsSupplier ? 0 : 1,
        supplierBarcode: parentIsSupplier,
        isNumbered: true,
      },
    ];
  }

  if (product.hasVariants) {
    return product.variants.map((variant) => {
      const supplierBarcode = parentIsSupplier || variant.barcodeSource === BARCODE_SOURCE.SUPPLIER;
      return {
        key: `${product.id}:${variant.id}`,
        productId: product.id,
        variantId: variant.id,
        name,
        subtitle: localize(variant.name, locale),
        // A variant always has a SKU; the barcode is what the label prints, so
        // the SKU only stands in if a barcode somehow never got generated.
        code: variant.barcode ?? variant.sku,
        suggestedCopies: supplierBarcode ? 0 : suggest(variant.stock),
        supplierBarcode,
        isNumbered: false,
      };
    });
  }

  return [
    {
      key: `${product.id}:product`,
      productId: product.id,
      variantId: null,
      name,
      subtitle: null,
      code: product.barcode ?? product.sku,
      suggestedCopies: parentIsSupplier ? 0 : suggest(product.stock ?? 0),
      supplierBarcode: parentIsSupplier,
      isNumbered: false,
    },
  ];
}

// Copies are held as strings (the integer-safe numeric input keeps them that
// way while being typed), so an empty or half-typed field reads as zero
// rather than crashing the preview.
export function parseCopies(value: string | undefined): number {
  if (value === undefined || !isNonNegativeIntegerString(value)) return 0;
  return Math.min(Number(value), LABEL_COPIES_MAX);
}

export function countLabels(lines: readonly LabelLine[], copies: Record<string, string>): number {
  return lines.reduce((total, line) => total + parseCopies(copies[line.key]), 0);
}

// One entry per physical sticker, in line order.
export function expandLabels(lines: readonly LabelLine[], copies: Record<string, string>): LabelPrintItem[] {
  const items: LabelPrintItem[] = [];
  for (const line of lines) {
    const count = parseCopies(copies[line.key]);
    for (let i = 0; i < count; i++) {
      items.push({ key: `${line.key}#${i}`, name: line.name, subtitle: line.subtitle, code: line.code });
    }
  }
  return items;
}

// Splits the run into printed pages: one label per page in thermal mode,
// columns x rows per sheet in A4 mode.
export function paginateLabels(items: readonly LabelPrintItem[], geometry: LabelGeometry): LabelPrintItem[][] {
  const perPage = geometry.printMode === "A4_GRID" ? Math.max(1, geometry.columns * geometry.rows) : 1;
  const pages: LabelPrintItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

// Reads the sheet description out of the Setting singleton (CLAUDE.md rule
// 14) — nothing about the label is hard-coded in the UI.
export function toLabelGeometry(setting: Setting): LabelGeometry {
  return {
    printMode: setting.labelPrintMode,
    widthMm: setting.labelWidthMm,
    heightMm: setting.labelHeightMm,
    columns: setting.labelColumns,
    rows: setting.labelRows,
    pageMarginTopMm: setting.labelPageMarginTopMm,
    pageMarginRightMm: setting.labelPageMarginRightMm,
    pageMarginBottomMm: setting.labelPageMarginBottomMm,
    pageMarginLeftMm: setting.labelPageMarginLeftMm,
    gapXMm: setting.labelGapXMm,
    gapYMm: setting.labelGapYMm,
  };
}

// The page the browser will actually print, in mm — one label in thermal
// mode, a full A4 sheet in grid mode.
export function printedPageSizeMm(geometry: LabelGeometry): { widthMm: number; heightMm: number } {
  return geometry.printMode === "A4_GRID"
    ? { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
    : { widthMm: geometry.widthMm, heightMm: geometry.heightMm };
}

export function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH;
}

// How many labels the configured grid actually fits across the usable width
// of the sheet — a column count that overflows the paper is the one geometry
// mistake that silently clips labels off the right-hand edge.
export function gridOverflowsPage(geometry: LabelGeometry): boolean {
  if (geometry.printMode !== "A4_GRID") return false;
  const usableWidth = A4_WIDTH_MM - geometry.pageMarginLeftMm - geometry.pageMarginRightMm;
  const usableHeight = A4_HEIGHT_MM - geometry.pageMarginTopMm - geometry.pageMarginBottomMm;
  const neededWidth = geometry.columns * geometry.widthMm + (geometry.columns - 1) * geometry.gapXMm;
  const neededHeight = geometry.rows * geometry.heightMm + (geometry.rows - 1) * geometry.gapYMm;
  // Half a millimetre of slack: rounding in the settings form shouldn't raise
  // a warning about a sheet that fits in practice.
  return neededWidth > usableWidth + 0.5 || neededHeight > usableHeight + 0.5;
}
