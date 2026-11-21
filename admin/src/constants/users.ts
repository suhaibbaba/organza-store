import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { UserListFilters } from "@/types/user";
import { ROLES } from "@organza/shared/constants/roles";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const USER_SEARCH_DEBOUNCE_MS = 400;

export const USERS_LIST_QUERY_KEY = "users" as const;

export const USERS_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const DEFAULT_USER_FILTERS: UserListFilters = {
  q: "",
  role: null,
  isActive: null,
  page: DEFAULT_PAGE,
};

export const USER_LIST_URL_PARAMS: UrlParams<UserListFilters> = {
  q: urlParam.text(),
  role: urlParam.optionalOneOf(ROLES),
  isActive: urlParam.optionalFlag(),
  page: urlParam.page(),
};
