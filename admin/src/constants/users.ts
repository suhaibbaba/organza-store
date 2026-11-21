import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, SORT_DIRECTIONS } from "@store/shared/constants/pagination";
import { ROLES } from "@store/shared/constants/roles";
import { USER_SORT_FIELDS } from "@store/shared/constants/user";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";
import type { UserListFilters, UserSortOption } from "@/types/user";

export const USER_SEARCH_DEBOUNCE_MS = 400;

export const USERS_LIST_QUERY_KEY = "users" as const;

export const DEFAULT_USER_FILTERS: UserListFilters = {
  q: "",
  role: null,
  isActive: null,
  sortBy: "createdAt",
  sortDir: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const USER_LIST_URL_PARAMS: UrlParams<UserListFilters> = {
  q: urlParam.text(),
  role: urlParam.optionalOneOf(ROLES),
  isActive: urlParam.optionalFlag(),
  sortBy: urlParam.oneOf(USER_SORT_FIELDS),
  sortDir: urlParam.oneOf(SORT_DIRECTIONS),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};

export const USER_SORT_OPTIONS: readonly UserSortOption[] = [
  { value: "createdAt-desc", sortBy: "createdAt", sortDir: "desc", labelKey: "newest" },
  { value: "createdAt-asc", sortBy: "createdAt", sortDir: "asc", labelKey: "oldest" },
  { value: "name-asc", sortBy: "name", sortDir: "asc", labelKey: "nameAToZ" },
  { value: "name-desc", sortBy: "name", sortDir: "desc", labelKey: "nameZToA" },
  { value: "role-asc", sortBy: "role", sortDir: "asc", labelKey: "role" },
];

export const USER_STATUS_OPTIONS = ["active", "inactive"] as const;

export const USER_AVATAR_SIZE = 40;
