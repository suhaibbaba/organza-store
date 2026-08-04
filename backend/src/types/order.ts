import type {
  DiscountType,
  Order,
  OrderChannel,
  OrderItem,
  OrderSortField,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
} from "@shared/types/order";

export type {
  DiscountType,
  Order,
  OrderChannel,
  OrderItem,
  OrderSortField,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
};

// One line's worth of stock movement: exactly one of variantId/productId is
// set (the variant owns the stock when the product has variants), plus how
// many units to take off or put back.
export interface StockMovement {
  productId: string | null;
  variantId: string | null;
  quantity: number;
}

// A priced line, resolved from the live catalogue at creation time and then
// frozen onto the OrderItem row. Money is carried as a 2dp string so it
// survives the hop into Prisma's Decimal columns without a float in between.
export interface PricedOrderItem {
  productId: string;
  variantId: string | null;
  name: unknown;
  variantName: unknown;
  sku: string | null;
  unitPrice: string;
  unitCost: string | null;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountAmount: string;
  lineTotal: string;
}

// The order-level half of the same computation.
export interface OrderTotals {
  subtotal: string;
  discountAmount: string;
  total: string;
}
