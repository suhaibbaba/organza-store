import type { ListProductsQuery } from "@store/shared/schemas/product";
import type { ProductPrintState, ProductSummary } from "@store/shared/types/product";
import type { Pagination } from "@store/shared/types/common";
import type { TableSort } from "@store/ui";
import type { ProductCompletenessFilter } from "@store/shared/constants/quickSell";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Product } from "@store/shared/types/product";

// Cropped to fill (thumbnails), whole inside the box, or its own size within a cap (detail page).
export type ProductImageFit = "cover" | "contain" | "natural";

// Separate from the API's ListProductsQuery so the UI can hold "unset" filters.
export interface ProductListFilters {
  q: string;
  categoryId: string | null;
  status: "active" | "hidden" | null;
  stock: "in_stock" | "out_of_stock" | null;
  priceMin: string;
  priceMax: string;
  // "all" here; the labels screen is the one that narrows it.
  printState: ProductPrintState;
  // Quick sell's queue: those pieces have no category, so no category filter could find them.
  completeness: ProductCompletenessFilter;
  sortBy: ListProductsQuery["sortBy"];
  sortDir: ListProductsQuery["sortDir"];
  page: number;
  pageSize: number;
}

export interface ProductFiltersValue {
  categoryId: string | null;
  status: ProductListFilters["status"];
  stock: ProductListFilters["stock"];
  priceMin: string;
  priceMax: string;
}

export interface ProductSortValue {
  sortBy: ProductListFilters["sortBy"];
  sortDir: ProductListFilters["sortDir"];
}

export interface ProductFiltersProps {
  value: ProductFiltersValue;
  sort: ProductSortValue;
  onApply: (value: ProductFiltersValue, sort: ProductSortValue) => void;
}

export interface ProductFilterChipsProps {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
}

export interface ProductTableProps {
  products: ProductSummary[];
  meta: Pagination | null;
  isLoading: boolean;
  isRefreshing: boolean;
  sort: TableSort;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface ProductPhotoProps {
  product: Pick<ProductSummary, "image" | "markedImage">;
  alt: string;
  className?: string;
  sizes: string;
  fit?: ProductImageFit;
}

// One photo on the product page: the saved numbered image, a product photo, or a variant's own photo.
export interface GalleryPhoto {
  id: string;
  url: string;
  mediumUrl: string;
  thumbnailUrl: string;
  kind: "numbered" | "product" | "variant";
  variantName: string | null;
}

export interface ProductDetailGalleryProps {
  photos: GalleryPhoto[];
  name: string;
}

export interface ProductFactProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  testId: string;
  action?: ReactNode;
}

export interface ProductCategoryFilterProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export interface ProductBarcodePrintProps {
  product: Product;
}
