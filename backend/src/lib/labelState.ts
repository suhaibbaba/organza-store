import { Prisma } from "@prisma/client";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import type { AnyRecord } from "@/types";

// Does this product still owe us a printed label?
//
// A piece that arrived already barcoded carries its label on the garment, so
// there is nothing to print and it has no business sitting in the "not printed
// yet" queue. It is excluded by its barcode SOURCE and nothing else —
// deliberately never by stamping `labelsPrintedAt`, which would record a print
// run that never happened and lie to whoever reads it later.
//
// Two shapes count as covered:
//   - a simple product whose own code is the supplier's;
//   - a product WITH variants whose PARENT carries a supplier code, which is
//     the shared-code case: one tag for every size, stuck on the piece rather
//     than printed per variant.
// A variant-bearing product on our own parent code still owes labels for
// whichever variants have not been given a supplier code of their own.
//
// A numbered shawl (spec.md) is judged on its parent alone, whatever its
// numbers say: it prints ONE label for the whole collection — the numbers live
// on the photo, not on separate tags (see the admin's buildLabelLines) — so
// supplier codes on its variants cover nothing, and letting them clear the debt
// would drop a product whose only label was never printed.
//
// Printing anyway is always possible — this decides a queue, never a lock.
export function needsLabel(product: AnyRecord): boolean {
  if (product.barcodeSource === BARCODE_SOURCE.SUPPLIER) return false;
  if (product.isNumbered === true) return true;

  const variants = (product.variants ?? []) as AnyRecord[];
  if (variants.length === 0) return true;
  return variants.some((variant) => variant.barcodeSource !== BARCODE_SOURCE.SUPPLIER);
}

// The same rule as SQL, for the product list's `printState=not_printed`
// filter — the queue has to be filtered in the query rather than sifted
// afterwards, or pagination would report counts that include pieces the
// screen then drops (CLAUDE.md rule 15). Kept beside needsLabel so the two can
// be read against each other; the branches are in the same order.
export const NEEDS_LABEL_WHERE: Prisma.ProductWhereInput = {
  barcodeSource: BARCODE_SOURCE.GENERATED,
  OR: [
    { isNumbered: true },
    { variants: { none: {} } },
    { variants: { some: { barcodeSource: BARCODE_SOURCE.GENERATED } } },
  ],
};
