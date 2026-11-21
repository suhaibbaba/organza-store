import type { IconName, SectionTone } from "@store/ui";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { ProductListFilters } from "@/types/product";
import { PRODUCT_PRINT_STATES, PRODUCT_SORT_FIELDS } from "@organza/shared/constants/product";
import { PRODUCT_COMPLETENESS_FILTERS } from "@organza/shared/constants/quickSell";
import { SORT_DIRECTIONS } from "@organza/shared/constants/pagination";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const PRODUCT_SEARCH_DEBOUNCE_MS = 250;

export const PRODUCT_LIST_QUERY_KEY = "products" as const;

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
  pageSize: DEFAULT_PAGE_SIZE,
};

// "Name" sorts by slug, made from the default-language name (rule 9); labels under products.sort.*.
export const PRODUCT_SORT_OPTIONS = [
  { value: "createdAt-desc", sortBy: "createdAt", sortDir: "desc", labelKey: "newest" },
  { value: "basePrice-asc", sortBy: "basePrice", sortDir: "asc", labelKey: "priceLowToHigh" },
  { value: "basePrice-desc", sortBy: "basePrice", sortDir: "desc", labelKey: "priceHighToLow" },
  { value: "slug-asc", sortBy: "slug", sortDir: "asc", labelKey: "nameAToZ" },
  { value: "slug-desc", sortBy: "slug", sortDir: "desc", labelKey: "nameZToA" },
  { value: "stock-asc", sortBy: "stock", sortDir: "asc", labelKey: "stockLowToHigh" },
  { value: "stock-desc", sortBy: "stock", sortDir: "desc", labelKey: "stockHighToLow" },
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

export const PRODUCT_STATUS_FILTERS = ["active", "hidden"] as const;
export const PRODUCT_STOCK_FILTERS = ["in_stock", "out_of_stock"] as const;

export const PRODUCT_LIST_URL_PARAMS: UrlParams<ProductListFilters> = {
  q: urlParam.text(),
  categoryId: urlParam.id(),
  status: urlParam.optionalOneOf(PRODUCT_STATUS_FILTERS),
  stock: urlParam.optionalOneOf(PRODUCT_STOCK_FILTERS),
  priceMin: urlParam.text(),
  priceMax: urlParam.text(),
  printState: urlParam.oneOf(PRODUCT_PRINT_STATES),
  completeness: urlParam.oneOf(PRODUCT_COMPLETENESS_FILTERS),
  sortBy: urlParam.oneOf(PRODUCT_SORT_FIELDS),
  sortDir: urlParam.oneOf(SORT_DIRECTIONS),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};
