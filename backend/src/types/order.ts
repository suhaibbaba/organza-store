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
} from "@organza/shared/types/order";

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

// The raw aggregate behind CollectionSummary. Postgres hands numeric back as
// Prisma.Decimal and count as BigInt; lib/orderCollection.ts is the only
// place that converts them (same convention as the report rows).
export interface CollectionSummaryRow {
  orderCount: bigint;
  amount: Prisma.Decimal | null;
  oldestCreatedAt: Date | null;
}

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
  /**
   * This line sells a piece that was typed at the counter rather than picked
   * from the catalogue (spec.md "Quick sell"). Absent on every ordinary line.
   */
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
