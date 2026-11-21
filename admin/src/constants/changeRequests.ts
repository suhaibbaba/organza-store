import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import type { ChangeRequestListFilters } from "@/types/changeRequest";
import { CHANGE_REQUEST_STATUSES } from "@store/shared/constants/changeRequest";
import { urlParam } from "@/lib/url-filters";
import type { UrlParams } from "@/types/urlFilters";

export const CHANGE_REQUEST_LIST_QUERY_KEY = "changeRequests" as const;
export const CHANGE_REQUEST_COUNT_QUERY_KEY = ["changeRequests", "count"] as const;

export const CHANGE_REQUEST_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

// So an Admin opening the app after a push finds the badge already right.
export const CHANGE_REQUEST_COUNT_REFETCH_MS = 60_000;

// Waiting first: that is why the screen exists.
export const DEFAULT_CHANGE_REQUEST_FILTERS: ChangeRequestListFilters = {
  status: "PENDING",
  page: DEFAULT_PAGE,
};

/** The status tabs, in the order they are shown. */
export const CHANGE_REQUEST_STATUS_TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

export const CHANGE_REQUEST_LIST_URL_PARAMS: UrlParams<ChangeRequestListFilters> = {
  status: urlParam.oneOf(CHANGE_REQUEST_STATUSES),
  page: urlParam.page(),
};
