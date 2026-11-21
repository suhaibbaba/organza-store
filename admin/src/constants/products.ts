import type { IconName, SectionTone } from "@store/ui";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { ProductListFilters } from "@/types/product";

export const PRODUCT_SEARCH_DEBOUNCE_MS = 400;

export const PRODUCT_LIST_QUERY_KEY = "products" as const;

export const PRODUCT_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const DEFAULT_PRODUCT_FILTERS: ProductListFilters = {
  q: "",
  categoryId: null,
  status: null,
  stock: null,
  priceMin: "",
  priceMax: "",
  printState: "all",
  completeness: "all",
  sortBy: "createdAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
};

// Each option pairs a (sortBy, sortDir) combination with a message key under
// `products.sort.*`. "name" sorts by `slug` — generated from the
// default-language name (CLAUDE.md rule 9) — since there's no separate
// name-sort field on the backend.
export const PRODUCT_SORT_OPTIONS = [
  { value: "createdAt-desc", sortBy: "createdAt", sortDir: "desc", labelKey: "newest" },
  { value: "basePrice-asc", sortBy: "basePrice", sortDir: "asc", labelKey: "priceLowToHigh" },
  { value: "basePrice-desc", sortBy: "basePrice", sortDir: "desc", labelKey: "priceHighToLow" },
  { value: "slug-asc", sortBy: "slug", sortDir: "asc", labelKey: "nameAToZ" },
  { value: "slug-desc", sortBy: "slug", sortDir: "desc", labelKey: "nameZToA" },
] as const;

export const PRODUCT_FORM_SECTIONS = {
  "basic-info": { icon: "file", tone: "blue" },
  pricing: { icon: "coins", tone: "green" },
  barcode: { icon: "barcode", tone: "violet" },
  variants: { icon: "layers", tone: "amber" },
  "numbered-hint": { icon: "list", tone: "rose" },
  "numbered-shawl": { icon: "list", tone: "rose" },
  status: { icon: "toggle", tone: "green" },
  kind: { icon: "shapes", tone: "violet" },
  photos: { icon: "image", tone: "blue" },
  inventory: { icon: "package", tone: "amber" },
} as const satisfies Record<string, { icon: IconName; tone: SectionTone }>;

export type ProductFormSectionName = keyof typeof PRODUCT_FORM_SECTIONS;

export const VARIANT_PICKER_SUMMARY_NAMES = 3;
