import { Prisma } from "@prisma/client";
import { BARCODE_SOURCE } from "@store/shared/constants/barcode";
import type { AnyRecord } from "@/types";

// Does this product still owe a label? Supplier-coded pieces are excluded by source, never by labelsPrintedAt.
export function needsLabel(product: AnyRecord): boolean {
  if (product.barcodeSource === BARCODE_SOURCE.SUPPLIER) {
    return false;
  }
  if (product.isNumbered === true) {
    return true;
  }

  const variants = (product.variants ?? []) as AnyRecord[];
  if (variants.length === 0) {
    return true;
  }
  return variants.some((variant) => variant.barcodeSource !== BARCODE_SOURCE.SUPPLIER);
}

// needsLabel as SQL for printState=not_printed, so pagination counts stay right (rule 15); same branch order.
export const NEEDS_LABEL_WHERE: Prisma.ProductWhereInput = {
  barcodeSource: BARCODE_SOURCE.GENERATED,
  OR: [
    { isNumbered: true },
    { variants: { none: {} } },
    { variants: { some: { barcodeSource: BARCODE_SOURCE.GENERATED } } },
  ],
};
