import type { Pagination } from "@store/shared/types/common";
import type { ReportPresetKey, ReturnsTotals, SoldItemsSort, TopSeller } from "@/types/report";

// The Sales log's URL state: a range, then how its sold pieces are ordered and paged.
export interface SalesLogFilters {
  preset: ReportPresetKey;
  from: string;
  to: string;
  sortBy: SoldItemsSort;
  page: number;
  pageSize: number;
}

export interface SoldItemsPage {
  items: TopSeller[];
  meta: Pagination | null;
}

export interface SoldItemsTableProps {
  items: TopSeller[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sortBy: SoldItemsSort;
  onSortChange: (sortBy: SoldItemsSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface SalesReturnsNoteProps {
  returns: ReturnsTotals;
}
