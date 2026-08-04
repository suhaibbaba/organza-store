import type {
  DISCOUNT_TYPES,
  ORDER_CHANNELS,
  ORDER_SORT_FIELDS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from "@/constants/order";
import type { I18n } from "@/types/common";

export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

// One sold line. Everything the receipt needs is snapshotted at creation, so
// renaming or repricing the product later never rewrites past sales — the
// product/variant ids are kept only as a link back to the live catalogue and
// go null if the variant is later removed.
export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  // Snapshots frozen at creation.
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  // Item-level discount, applied to this line before the order-level one.
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  lineTotal: string;
  returnedQuantity: number;
  // SENSITIVE (CLAUDE.md rule 19): Admin + Manager only — absent entirely
  // from Employee responses.
  unitCost?: string | null;
}

export interface Order {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  // Customer snapshot — required for WHATSAPP/WEBSITE, unused for STORE.
  customerName: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerAddress: string | null;
  // Optional map pin alongside the written address (WGS84 degrees).
  customerLatitude: number | null;
  customerLongitude: number | null;
  note: string | null;
  // All money is computed on the server from the item snapshots; the client
  // never supplies a total.
  subtotal: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  // Set the moment stock is taken off the shelf for this order, so it can
  // never be deducted twice.
  stockDeductedAt: string | null;
  items: OrderItem[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// Lighter list-view DTO (GET /api/orders) — no per-item breakdown.
export interface OrderSummary {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  discountAmount: string;
  total: string;
  itemCount: number;
  stockDeductedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
