import type { ListProductsQuery } from "@shared/schemas/product";

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
  sortBy: ListProductsQuery["sortBy"];
  sortDir: ListProductsQuery["sortDir"];
  page: number;
}
