import type { ListProductsQuery } from "@organza/shared/schemas/product";
import type { ProductPrintState } from "@organza/shared/types/product";
import type { ProductCompletenessFilter } from "@organza/shared/constants/quickSell";

// How a product photo meets the box it is drawn in: cropped to fill it
// (thumbnails), shown whole inside it (a plate the photo is centred on), or
// given no box at all and drawn at its own size within a cap (the detail
// page). See components/products/product-image.tsx.
export type ProductImageFit = "cover" | "contain" | "natural";

// Client-side filter state for the products list screen. Kept separate from
// `ListProductsQuery` (the API's validated query shape) so the UI can hold
// "unset" filters without fighting the schema's defaults.
export interface ProductListFilters {
  q: string;
  categoryId: string | null;
  status: "active" | "hidden" | null;
  stock: "in_stock" | "out_of_stock" | null;
  priceMin: string;
  priceMax: string;
  // Barcode-label print state. "all" on the products screen; the labels
  // screen is the one that actually narrows it.
  printState: ProductPrintState;
  // Quick sell's work queue (spec.md "Quick sell"). "all" everywhere except
  // the "needs completing" view, which is the whole products screen narrowed
  // to the pieces sold before they were entered — they have no category, so
  // no category filter on this same screen could ever find them.
  completeness: ProductCompletenessFilter;
  sortBy: ListProductsQuery["sortBy"];
  sortDir: ListProductsQuery["sortDir"];
  page: number;
}
