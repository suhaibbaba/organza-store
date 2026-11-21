import type { Prisma } from "@prisma/client";
import type {
  CollectResult,
  CollectionSummary,
  CustomerSuggestion,
  DiscountType,
  Order,
  OrderChannel,
  OrderItem,
  OrderSortField,
  OrderStatus,
  OrderSummary,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from "@store/shared/types/order";

export type {
  CollectResult,
  CollectionSummary,
  CustomerSuggestion,
  DiscountType,
  Order,
  OrderChannel,
  OrderItem,
  OrderSortField,
  OrderStatus,
  OrderSummary,
  OrderType,
  PaymentMethod,
  PaymentStatus,
};

// Raw CollectionSummary aggregate (Decimal, BigInt), converted only in lib/orderCollection.ts.
export interface CollectionSummaryRow {
  orderCount: bigint;
  amount: Prisma.Decimal | null;
  oldestCreatedAt: Date | null;
  withCourierCount: bigint;
  withCourierAmount: Prisma.Decimal | null;
  notShippedCount: bigint;
  notShippedAmount: Prisma.Decimal | null;
  overdueCount: bigint;
}

// One line's stock movement: exactly one of variantId/productId, and the quantity.
export interface StockMovement {
  productId: string | null;
  variantId: string | null;
  quantity: number;
}

// A priced line frozen onto OrderItem; money as a 2dp string so no float sits in between.
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
  /** A line for a piece typed at the counter (quick sell); absent on ordinary lines. */
  quickSold?: boolean;
}

/** What the caller typed for a quick-sold line: a name, a price, a "which one". */
export interface QuickSellRequestedItem {
  name: string;
  price: string;
  detail?: string;
}

// The order-level half of the same computation.
export interface OrderTotals {
  subtotal: string;
  discountAmount: string;
  total: string;
}
