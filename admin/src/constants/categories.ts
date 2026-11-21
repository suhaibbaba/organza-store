import { urlParam } from "@/lib/url-filters";
import type { CategoryListFilters } from "@/types/category";
import type { UrlParams } from "@/types/urlFilters";

export const CATEGORY_SEARCH_DEBOUNCE_MS = 300;

export const DEFAULT_CATEGORY_FILTERS: CategoryListFilters = { q: "" };

export const CATEGORY_LIST_URL_PARAMS: UrlParams<CategoryListFilters> = { q: urlParam.text() };
