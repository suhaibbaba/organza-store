export const PRODUCT_SORT_FIELDS = ["createdAt", "basePrice", "stock", "slug"] as const;

// Barcode-label print state, as a product-list filter: "which labels still
// have to be printed" is the whole workflow, so it is a filter rather than a
// flag the caller has to post-process. `all` is the default (no filtering).
export const PRODUCT_PRINT_STATES = ["all", "printed", "not_printed"] as const;

// What one scanned code resolved to (GET /api/products/lookup).
//   ITEM             — exactly one sellable thing; put it in the cart.
//   NUMBER_SELECTION — a numbered shawl's parent label (spec.md "Numbered
//                      shawls"): the label covers the whole collection, so
//                      the cashier still has to pick which number. Nothing
//                      sellable is returned, on purpose — selling the parent
//                      would deduct stock from the wrong place.
export const PRODUCT_LOOKUP_KINDS = ["ITEM", "NUMBER_SELECTION"] as const;

export const PRODUCT_LOOKUP_KIND = {
  ITEM: "ITEM",
  NUMBER_SELECTION: "NUMBER_SELECTION",
} as const;
