import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@organza/shared/constants/pagination";
import type { UserListFilters } from "@/types/user";

export const USER_SEARCH_DEBOUNCE_MS = 400;

export const USERS_LIST_QUERY_KEY = "users" as const;

export const USERS_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const DEFAULT_USER_FILTERS: UserListFilters = {
  q: "",
  role: null,
  isActive: null,
  page: DEFAULT_PAGE,
};
