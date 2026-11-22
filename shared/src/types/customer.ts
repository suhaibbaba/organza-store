import type { CUSTOMER_SORT_FIELDS } from "@/constants/customer";
import type { I18n } from "@/types/common";
import type { OrderCreator, OrderStatus, PaymentStatus } from "@/types/order";

export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export interface Customer {
  id: string;
  name: string;
  // E.164 exactly as entered (rule 18).
  phone: string;
  whatsapp: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// A list row: what they owe, how many pieces are kept for them, when they last bought.
export interface CustomerSummary extends Customer {
  balance: string;
  openOrderCount: number;
  keptPieceCount: number;
  orderCount: number;
  lastOrderAt: string | null;
}

export interface CustomerKeptPiece {
  orderId: string;
  orderNumber: number;
  orderItemId: string;
  name: I18n;
  variantName: I18n | null;
  quantity: number;
  thumbnailUrl: string | null;
  soldAt: string;
}

export interface CustomerOrderRow {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  onCredit: boolean;
  total: string;
  paidAmount: string;
  balance: string;
  itemCount: number;
  createdAt: string;
}

export interface CustomerPaymentRow {
  id: string;
  orderId: string;
  orderNumber: number;
  amount: string;
  receivedAt: string;
  note: string | null;
  receivedBy: OrderCreator | null;
}

// GET /api/customers/:id — the customer, their balance, kept pieces, orders and payments (newest first, bounded).
export interface CustomerDetail extends CustomerSummary {
  keptPieces: CustomerKeptPiece[];
  orders: CustomerOrderRow[];
  payments: CustomerPaymentRow[];
}

// How a payment taken on the customer's page is spread, oldest order first.
export interface CustomerPaymentAllocation {
  orderId: string;
  orderNumber: number;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
}

export interface CustomerPaymentResult {
  allocations: CustomerPaymentAllocation[];
  // True when only previewed: nothing was saved.
  preview: boolean;
  balance: string;
}

// The Customers page header: the shop-wide total only with dashboard.view (rule 19).
export interface CustomerListMeta {
  totalDebt?: string;
  owingCount?: number;
}
