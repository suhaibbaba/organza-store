import type { I18n } from "@store/shared/types/common";
import type { DiscountType } from "@store/shared/types/order";
import type { QuickSellItemInput } from "@store/shared/schemas/order";

// Copied in for display so the cart never re-fetches; the order API re-prices everything.
export interface CartLine {
  // productId[+variantId], so a re-scan bumps the line; a quick-sold line gets a generated key instead.
  key: string;
  productId: string | null;
  variantId: string | null;
  // Null for ordinary lines; the one place the POS names a price (no catalogue entry exists).
  quickSell: QuickSellItemInput | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  // Keeps the cart sensible; the backend's atomic stock guard is the real check (two tills, one piece).
  availableStock: number;
  // Copied in so the line can show how close to gone the piece is without re-fetching.
  trackLowStock: boolean;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: string | null;
}

// Both null = no discount; the schema refuses a half-set pair.
export interface DiscountState {
  type: DiscountType | null;
  value: string | null;
}

export interface CartTotals {
  itemCount: number;
  // Sum of line totals, item discounts already applied.
  subtotal: string;
  // Shown so the customer sees the saving already baked into the subtotal.
  itemDiscountTotal: string;
  // What the order-level discount takes off the subtotal.
  orderDiscountAmount: string;
  total: string;
}
