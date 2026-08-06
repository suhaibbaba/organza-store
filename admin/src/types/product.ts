import type { ListProductsQuery } from "@shared/schemas/product";
import type { ProductPrintState } from "@shared/types/product";

// How a product photo meets the box it is drawn in: cropped to fill it
// (thumbnails) or shown whole inside it (the detail page). See
// components/products/product-image.tsx.
export type ProductImageFit = "cover" | "contain";

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
  sortBy: ListProductsQuery["sortBy"];
  sortDir: ListProductsQuery["sortDir"];
  page: number;
}
