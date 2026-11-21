import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import { EXPENSE_APPROVAL_STATUSES, EXPENSE_SORT_FIELDS } from "@store/shared/constants/expense";
import { REPORT_PRESETS } from "@/constants/reports";
import { urlParam } from "@/lib/url-filters";
import type { ExpenseListFilters } from "@/types/expense";
import type { UrlParams } from "@/types/urlFilters";

export const EXPENSE_LIST_QUERY_KEY = "expenses.list";
export const EXPENSE_SUMMARY_QUERY_KEY = "expenses.summary";
export const EXPENSE_CATEGORIES_QUERY_KEY = "expenses.categories";
export const EXPENSE_STALE_TIME_MS = 60 * 1000;
export const EXPENSE_SEARCH_DEBOUNCE_MS = 300;

// ?new=1 opens the add form straight away: the dashboard's "expense" button lands here.
export const EXPENSE_NEW_PARAM = "new";

// This month by default: it is the period the rent and salaries are paid in.
export const DEFAULT_EXPENSE_FILTERS: ExpenseListFilters = {
  preset: "thisMonth",
  from: "",
  to: "",
  q: "",
  categoryId: null,
  approvalStatus: null,
  sortBy: "date",
  sortDir: "desc",
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const EXPENSE_LIST_URL_PARAMS: UrlParams<ExpenseListFilters> = {
  preset: urlParam.oneOf(REPORT_PRESETS),
  from: urlParam.text(),
  to: urlParam.text(),
  q: urlParam.text(),
  categoryId: urlParam.id(),
  approvalStatus: urlParam.optionalOneOf(EXPENSE_APPROVAL_STATUSES),
  sortBy: urlParam.oneOf(EXPENSE_SORT_FIELDS),
  sortDir: urlParam.oneOf(["asc", "desc"] as const),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};

export const EXPENSE_STATUS_TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" } as const;

// Categories shown on the breakdown before "+N more".
export const EXPENSE_BREAKDOWN_LIMIT = 6;

// A category's key is minted, never typed: the shop only ever sees the name.
export const EXPENSE_CATEGORY_KEY_PREFIX = "c-";
