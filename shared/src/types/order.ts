import type {
  DISCOUNT_TYPES,
  ORDER_CHANNELS,
  ORDER_SORT_FIELDS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/constants/order";
import type { I18n } from "@/types/common";

export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
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

// Who rang the sale up, named rather than referenced by id so the admin can
// show it without pulling the staff list (which is Admin-only). Deliberately
// just id + name: nothing else about a staff member belongs on an order.
export interface OrderCreator {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  // Whether the money for this sale is actually in the shop's hands. A
  // counter sale is COLLECTED on the spot; a parcel handed to the delivery
  // company stays PENDING_COLLECTION until an Admin/Manager records that the
  // company has paid for it.
  paymentStatus: PaymentStatus;
  collectedAt: string | null;
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
  // Soft delete: a deleted sale is hidden from every endpoint, not destroyed.
  deletedAt: string | null;
  items: OrderItem[];
  createdById: string;
  createdBy: OrderCreator | null;
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
  // Carried on the list row too: the outstanding-money view is a filtered
  // order list, so a row has to be able to say whether it has been collected.
  paymentStatus: PaymentStatus;
  collectedAt: string | null;
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

// GET /api/orders/customer-suggestions — one entry per repeat customer, for
// the phone autocomplete on the POS's WhatsApp order form. Customers are
// still deferred as an entity (spec.md "Customer information"), so this is
// the newest snapshot written under that number rather than a stored record:
// if the address changed on the last order, that is the one offered back.
export interface CustomerSuggestion {
  // Exactly as it was stored, on its own prefix (CLAUDE.md rule 18).
  phone: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  // When that snapshot was taken — the newest order under this number.
  lastOrderAt: string;
}

// GET /api/orders/collection-summary — what the delivery company still owes
// the shop, across every order regardless of date. The amount is net of
// returns and excludes cancelled sales, computed exactly like report revenue
// so the two figures can never disagree.
export interface CollectionSummary {
  orderCount: number;
  amount: string;
  // When the oldest still-uncollected sale was taken — "money that has been
  // owed since 12 July" is what makes an outstanding total actionable.
  oldestCreatedAt: string | null;
}

// POST /api/orders/collect — the result of settling a batch. `collectedIds`
// are the orders this call moved; `alreadyCollectedIds` were settled before
// it ran (marking twice is a no-op, not an error, so two people tapping at
// once can't produce a failure).
export interface CollectResult {
  collectedIds: string[];
  alreadyCollectedIds: string[];
  collectedAt: string;
}
