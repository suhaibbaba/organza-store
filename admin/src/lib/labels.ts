import { BARCODE_SOURCE } from "@store/shared/constants/barcode";
import { clampQuantity } from "@store/shared/constants/quantity";
import type { Product } from "@store/shared/types/product";
import type { ProductImageRef } from "@store/shared/types/variant";
import type { Setting } from "@store/shared/types/setting";
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

// Reuses the products list endpoint and its cache.
export function toProductListFilters(filters: LabelListFilters): ProductListFilters {
  return {
    ...DEFAULT_PRODUCT_FILTERS,
    q: filters.q,
    categoryId: filters.categoryId,
    printState: filters.printState,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function hasActiveLabelFilters(filters: LabelListFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    Boolean(filters.categoryId) ||
    filters.printState !== DEFAULT_LABEL_FILTERS.printState
  );
}

export function isNumberedProduct(product: Pick<Product, "isNumbered">): boolean {
  return product.isNumbered;
}

function primaryThumb(images: readonly ProductImageRef[]): string | null {
  const primary = images.find((image) => image.isPrimary) ?? [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return primary?.thumbnailUrl ?? null;
}

// Simple: copies = stock; variants: one line each; numbered shawl: the parent, count typed. Supplier codes start at 0.
export function buildLabelLines(product: Product, locale: string): LabelLine[] {
  const name = localize(product.name, locale);
  // Capped at the field's own limit; the source stock travels with the line so the screen can say so.
  const suggest = (stock: number) => clampQuantity(stock, 0, LABEL_COPIES_MAX);
  // A supplier code on the parent is one tag for every variant.
  const parentIsSupplier = product.barcodeSource === BARCODE_SOURCE.SUPPLIER;
  const productThumb = primaryThumb(product.images);

  if (isNumberedProduct(product)) {
    return [
      {
        key: `${product.id}:product`,
        productId: product.id,
        variantId: null,
        name,
        subtitle: null,
        thumbnailUrl: product.markedImage?.thumbnailUrl ?? productThumb,
        code: product.barcode,
        suggestedCopies: parentIsSupplier ? 0 : 1,
        // The numbers live on the photo, so the count is a choice, not stock.
        stock: null,
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
        thumbnailUrl: primaryThumb(variant.images) ?? productThumb,
        // The SKU stands in only if no barcode was ever generated.
        code: variant.barcode ?? variant.sku,
        suggestedCopies: supplierBarcode ? 0 : suggest(variant.stock),
        // Shown even when proposed at zero, so an override knows the real stock.
        stock: variant.stock,
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
      thumbnailUrl: productThumb,
      code: product.barcode ?? product.sku,
      suggestedCopies: parentIsSupplier ? 0 : suggest(product.stock ?? 0),
      stock: product.stock ?? 0,
      supplierBarcode: parentIsSupplier,
      isNumbered: false,
    },
  ];
}

// Held as strings while typed, so a half-typed field reads as zero.
export function parseCopies(value: string | undefined): number {
  if (value === undefined || !isNonNegativeIntegerString(value)) {
    return 0;
  }
  return clampQuantity(Number(value), 0, LABEL_COPIES_MAX);
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

export function paginateLabels(items: readonly LabelPrintItem[], geometry: LabelGeometry): LabelPrintItem[][] {
  const perPage = geometry.printMode === "A4_GRID" ? Math.max(1, geometry.columns * geometry.rows) : 1;
  const pages: LabelPrintItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

// From the Setting singleton (rule 14).
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

export function printedPageSizeMm(geometry: LabelGeometry): { widthMm: number; heightMm: number } {
  return geometry.printMode === "A4_GRID"
    ? { widthMm: A4_WIDTH_MM, heightMm: A4_HEIGHT_MM }
    : { widthMm: geometry.widthMm, heightMm: geometry.heightMm };
}

export function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH;
}

// An overflowing grid silently clips labels off the edge.
export function gridOverflowsPage(geometry: LabelGeometry): boolean {
  if (geometry.printMode !== "A4_GRID") {
    return false;
  }
  const usableWidth = A4_WIDTH_MM - geometry.pageMarginLeftMm - geometry.pageMarginRightMm;
  const usableHeight = A4_HEIGHT_MM - geometry.pageMarginTopMm - geometry.pageMarginBottomMm;
  const neededWidth = geometry.columns * geometry.widthMm + (geometry.columns - 1) * geometry.gapXMm;
  const neededHeight = geometry.rows * geometry.heightMm + (geometry.rows - 1) * geometry.gapYMm;
  // Half a millimetre of slack for rounding in the settings form.
  return neededWidth > usableWidth + 0.5 || neededHeight > usableHeight + 0.5;
}
