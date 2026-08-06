import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@shared/constants/pagination";
import type { ChangeRequestListFilters } from "@/types/changeRequest";

export const CHANGE_REQUEST_LIST_QUERY_KEY = "changeRequests" as const;
export const CHANGE_REQUEST_COUNT_QUERY_KEY = ["changeRequests", "count"] as const;

export const CHANGE_REQUEST_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

// How often the badge in the navigation re-checks. Requests arrive while
// somebody is already looking at another screen, and an Admin who is pushed a
// notification should find the number already right when they open the app.
// Slow enough not to be a poll worth worrying about on a phone's data.
export const CHANGE_REQUEST_COUNT_REFETCH_MS = 60_000;

// Waiting first — that is the whole reason the screen exists. The decided
// ones are one tap away, so nothing is hidden.
export const DEFAULT_CHANGE_REQUEST_FILTERS: ChangeRequestListFilters = {
  status: "PENDING",
  page: DEFAULT_PAGE,
};

/** The status tabs, in the order they are shown. */
export const CHANGE_REQUEST_STATUS_TABS = ["PENDING", "APPROVED", "REJECTED"] as const;
