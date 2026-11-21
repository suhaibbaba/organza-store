import type {
  DISCOUNT_TYPES,
  ORDER_CHANNELS,
  ORDER_SORT_FIELDS,
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "@/constants/order";
import type { I18n } from "@/types/common";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export type OrderType = (typeof ORDER_TYPES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

// Snapshotted at creation so a later rename or reprice never rewrites a past sale; the ids are only a link back.
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
  // Quick-sold at the counter (spec.md "Quick sell"); a snapshot, so it outlives the product's completion.
  quickSold: boolean;
  thumbnailUrl: string | null;
  // SENSITIVE (rule 19): Admin only — absent, not null, for everyone else.
  unitCost?: string | null;
}

// Just id + name, so the admin can show it without the Admin-only staff list.
export interface OrderCreator {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  // A gift charges nothing; its cost is reported as an expense, never as cost of goods sold.
  type: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  // A courier parcel stays PENDING_COLLECTION until an Admin/Manager records the company has paid.
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
  // Computed on the server from the item snapshots; the client never supplies a total.
  subtotal: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  // Stored on the order so it survives the product's completion and the list can filter on it cheaply.
  hasQuickSale: boolean;
  // Set when stock leaves the shelf, so it can never be deducted twice.
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
export interface OrderPreviewItem {
  id: string;
  name: I18n;
  variantName: I18n | null;
  quantity: number;
  thumbnailUrl: string | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  type: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  collectedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  discountAmount: string;
  total: string;
  itemCount: number;
  // The dearest few lines, highest unit price first; itemCount says how many there are in all.
  previewItems: OrderPreviewItem[];
  // Stored on the order so it survives the product's completion and the list can filter on it cheaply.
  hasQuickSale: boolean;
  stockDeductedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// One entry per repeat customer: the newest snapshot under that number, since there is no Customer table yet.
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

// Net of returns and free of cancelled sales, computed like report revenue so the two never disagree.
export interface CollectionSummary {
  orderCount: number;
  amount: string;
  // The oldest still-uncollected sale, which is what makes the outstanding total actionable.
  oldestCreatedAt: string | null;
}

// Collecting twice is a no-op, so two people tapping at once can't produce a failure.
export interface CollectResult {
  collectedIds: string[];
  alreadyCollectedIds: string[];
  collectedAt: string;
}
