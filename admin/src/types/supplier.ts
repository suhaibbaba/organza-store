import type {
  Supplier,
  SupplierDetail,
  SupplierInvoiceRow,
  SupplierListMeta,
  SupplierPaymentAllocation,
  SupplierPaymentResult,
  SupplierPaymentRow,
  SupplierSortField,
  SupplierSummary,
} from "@store/shared/types/supplier";
import type { Pagination } from "@store/shared/types/common";

export type {
  Supplier,
  SupplierDetail,
  SupplierInvoiceRow,
  SupplierListMeta,
  SupplierPaymentAllocation,
  SupplierPaymentResult,
  SupplierPaymentRow,
  SupplierSortField,
  SupplierSummary,
};

export interface SupplierListFilters {
  q: string;
  owing: boolean;
  sortBy: SupplierSortField;
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export type SupplierListPage = { suppliers: SupplierSummary[]; meta: (Pagination & SupplierListMeta) | null };

export type SupplierFormTarget = { mode: "create" } | { mode: "edit"; supplier: Supplier };

export type SupplierInvoiceTarget = { mode: "create" } | { mode: "edit"; invoice: SupplierInvoiceRow };

// Paying the supplier's account (oldest first) or one invoice.
export type SupplierPaymentTarget = { invoice: SupplierInvoiceRow | null };
