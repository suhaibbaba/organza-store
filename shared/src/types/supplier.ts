import type { SUPPLIER_SORT_FIELDS } from "@/constants/supplier";
import type { OrderCreator } from "@/types/order";

export type SupplierSortField = (typeof SUPPLIER_SORT_FIELDS)[number];

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// A list row: what the shop owes them and when they last invoiced.
export interface SupplierSummary extends Supplier {
  balance: string;
  openInvoiceCount: number;
  invoiceCount: number;
  lastInvoiceAt: string | null;
}

// Shop-wide figure for the list header.
export interface SupplierListMeta {
  totalOwed: string;
  owingCount: number;
}

export interface SupplierInvoiceRow {
  id: string;
  invoiceNumber: string | null;
  // YYYY-MM-DD, as printed on the invoice.
  invoiceDate: string;
  total: string;
  paidAmount: string;
  balance: string;
  note: string | null;
  paymentCount: number;
  createdAt: string;
  createdBy: OrderCreator | null;
}

export interface SupplierPaymentRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  amount: string;
  fromDrawer: boolean;
  paidAt: string;
  note: string | null;
  paidBy: OrderCreator | null;
}

// GET /api/suppliers/:id — the supplier, their balance, invoices and payments (newest first, bounded).
export interface SupplierDetail extends SupplierSummary {
  totalInvoiced: string;
  totalPaid: string;
  invoices: SupplierInvoiceRow[];
  payments: SupplierPaymentRow[];
}

export interface SupplierPaymentAllocation {
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
}

export interface SupplierPaymentResult {
  allocations: SupplierPaymentAllocation[];
  preview: boolean;
  // What the shop still owes this supplier after the payment.
  balance: string;
}
