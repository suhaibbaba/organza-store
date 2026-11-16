export const PRODUCT_SORT_FIELDS = ["createdAt", "basePrice", "stock", "slug"] as const;

// Barcode-label print state, as a product-list filter: "which labels still
// have to be printed" is the whole workflow, so it is a filter rather than a
// flag the caller has to post-process. `all` is the default (no filtering).
export const PRODUCT_PRINT_STATES = ["all", "printed", "not_printed"] as const;

// What one scanned code resolved to (GET /api/products/lookup).
//   ITEM              — exactly one sellable thing; put it in the cart.
//   VARIANT_SELECTION — the code was the PARENT of a product that has
//                       variants, so it stands for the whole piece rather
//                       than for one of them and the cashier still has to
//                       pick which. Nothing sellable is returned, on purpose:
//                       selling the parent would deduct stock from the wrong
//                       place, and the orders API refuses it anyway
//                       (error.order.variant_required).
//
// One mechanism, two flavours of the same answer. It started as the numbered
// shawls' parent scan (spec.md "Numbered shawls" — one photo, numbers drawn
// on it, one label for the collection) and now covers every parent barcode,
// because a supplier that prints ONE code for all sizes leaves the shop in
// exactly the same position: the code identifies the garment, not the size
// that just sold. `numbers` is still filled for a numbered product, since its
// picker is laid out by number; an ordinary parent's variants are picked from
// `product.variants`.
export const PRODUCT_LOOKUP_KINDS = ["ITEM", "VARIANT_SELECTION"] as const;

export const PRODUCT_LOOKUP_KIND = {
  ITEM: "ITEM",
  VARIANT_SELECTION: "VARIANT_SELECTION",
} as const;
