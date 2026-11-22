import type {
  Customer,
  CustomerDetail,
  CustomerKeptPiece,
  CustomerListMeta,
  CustomerOrderRow,
  CustomerPaymentAllocation,
  CustomerPaymentResult,
  CustomerPaymentRow,
  CustomerSortField,
  CustomerSummary,
} from "@store/shared/types/customer";
import type { Pagination } from "@store/shared/types/common";

export type {
  Customer,
  CustomerDetail,
  CustomerKeptPiece,
  CustomerListMeta,
  CustomerOrderRow,
  CustomerPaymentAllocation,
  CustomerPaymentResult,
  CustomerPaymentRow,
  CustomerSortField,
  CustomerSummary,
};

export interface CustomerListFilters {
  q: string;
  owing: boolean;
  keptPieces: boolean;
  sortBy: CustomerSortField;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export type CustomerListPage = { customers: CustomerSummary[]; meta: (Pagination & CustomerListMeta) | null };

export type CustomerFormTarget = { mode: "create" } | { mode: "edit"; customer: Customer };
