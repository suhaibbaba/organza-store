import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@store/shared/constants/pagination";
import { DEFAULT_SOLD_ITEMS_SORT, SOLD_ITEMS_SORTS } from "@store/shared/constants/report";
import { urlParam } from "@/lib/url-filters";
import type { ReportPresetKey } from "@/types/report";
import type { SalesLogFilters } from "@/types/sales";
import type { UrlParams } from "@/types/urlFilters";

export const SALES_PERIOD_QUERY_KEY = "sales.period";
export const SOLD_ITEMS_QUERY_KEY = "sales.soldItems";

// Today, the last two days, the last week, the last month, or any from–to.
export const SALES_PRESETS: readonly ReportPresetKey[] = ["today", "last2Days", "last7Days", "last30Days", "custom"];

export const DEFAULT_SALES_FILTERS: SalesLogFilters = {
  preset: "today",
  from: "",
  to: "",
  sortBy: DEFAULT_SOLD_ITEMS_SORT,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
};

export const SALES_LOG_URL_PARAMS: UrlParams<SalesLogFilters> = {
  preset: urlParam.oneOf(SALES_PRESETS),
  from: urlParam.text(),
  to: urlParam.text(),
  sortBy: urlParam.oneOf(SOLD_ITEMS_SORTS),
  page: urlParam.page(),
  pageSize: urlParam.pageSize(),
};
