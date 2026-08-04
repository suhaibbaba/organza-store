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
  status: "NEW" | "PREPARING" | "DELIVERING" | "RECEIVED" | "COMPLETED" | "CANCELLED" | "RETURNED";
  paymentMethod: "CASH";
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
  items: OrderItemDto[];
  createdById: string;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: number;
  channel: "STORE" | "WHATSAPP" | "WEBSITE";
  status: OrderDto["status"];
  total: string;
  itemCount: number;
}
