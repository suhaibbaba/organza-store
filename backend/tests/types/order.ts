// Mirrors the DTOs built by backend/src/lib/orderSerialize.ts. Those
// serializers build plain objects rather than exporting a named response
// type, so — like tests/types/product.ts — the response shape the suite
// asserts against lives here instead of being redeclared per test file.
export interface OrderItemDto {
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  discountType: "PERCENT" | "AMOUNT" | null;
  discountValue: string | null;
  discountAmount: string;
  lineTotal: string;
  returnedQuantity: number;
  // Role-gated (CLAUDE.md rule 19): absent entirely for Employee responses.
  unitCost?: string | null;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  channel: "STORE" | "WHATSAPP" | "WEBSITE";
  // SALE or GIFT (spec.md "Cash drawer & expenses" -> Gifts).
  type: "SALE" | "GIFT";
  status: "NEW" | "PREPARING" | "HANDED_TO_COURIER" | "COMPLETED" | "CANCELLED" | "RETURNED";
  paymentMethod: "CASH";
  // Whether the money is in the shop's hands yet — separate from the status
  // above, because a courier order is paid for long after it is sold.
  paymentStatus: "PENDING_COLLECTION" | "COLLECTED";
  collectedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerLatitude: number | null;
  customerLongitude: number | null;
  note: string | null;
  subtotal: string;
  discountType: "PERCENT" | "AMOUNT" | null;
  discountValue: string | null;
  discountAmount: string;
  total: string;
  stockDeductedAt: string | null;
  deletedAt: string | null;
  items: OrderItemDto[];
  createdById: string;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: number;
  channel: "STORE" | "WHATSAPP" | "WEBSITE";
  // SALE or GIFT (spec.md "Cash drawer & expenses" -> Gifts).
  type: "SALE" | "GIFT";
  status: OrderDto["status"];
  paymentStatus: OrderDto["paymentStatus"];
  collectedAt: string | null;
  total: string;
  itemCount: number;
}

// POST /api/orders/collect
export interface CollectResultDto {
  collectedIds: string[];
  alreadyCollectedIds: string[];
  collectedAt: string;
}

// GET /api/orders/collection-summary
export interface CollectionSummaryDto {
  orderCount: number;
  amount: string;
  oldestCreatedAt: string | null;
}

// GET /api/orders/customer-suggestions
export interface CustomerSuggestionDto {
  phone: string;
  name: string | null;
  whatsapp: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  lastOrderAt: string;
}
