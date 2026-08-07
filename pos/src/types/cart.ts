import type { I18n } from "@shared/types/common";
import type { DiscountType } from "@shared/types/order";

// One line in the open sale. Everything needed to render the line is copied
// in when it is added, so scrolling the cart never re-fetches anything —
// the counter has to stay responsive with a customer standing at it.
//
// These copies are for display only: the order API is sent nothing but ids,
// quantities and discounts, and re-reads the price and name itself
// (backend/src/lib/orderPricing.ts), so a stale price here can never become
// a wrong sale — only a figure worth refreshing.
export interface CartLine {
  // productId, or productId + variantId — the identity of a sellable thing.
  // Scanning the same item twice bumps the existing line rather than adding
  // a second one, which is what a cashier expects when re-scanning.
  key: string;
  productId: string;
  variantId: string | null;
  name: I18n;
  variantName: I18n | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: string;
  // What the catalogue held when the line was added, used to stop the
  // cashier building a cart the backend will reject. The backend's atomic
  // stock guard remains the real check (two tills, one last piece).
  availableStock: number;
  // The parent product's opt-in low-stock flag (Product.trackLowStock),
  // copied in for the same reason the name and the price are: the line says
  // in colour how close to gone this piece is, and the cart must not have to
  // re-fetch a product to draw itself.
  trackLowStock: boolean;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: string | null;
}

// A (type, value) discount pair, at either level. Both null = no discount;
// the two always move together (the create-order schema refuses a half-set
// pair).
export interface DiscountState {
  type: DiscountType | null;
  value: string | null;
}

// Everything the totals row and the checkout button need, all as fixed-2dp
// strings so they can go straight to the currency formatter.
export interface CartTotals {
  itemCount: number;
  // Sum of line totals, item discounts already applied.
  subtotal: string;
  // What the item-level discounts took off, summed — shown so the customer
  // can see the saving, since it is already baked into the subtotal.
  itemDiscountTotal: string;
  // What the order-level discount takes off the subtotal.
  orderDiscountAmount: string;
  total: string;
}
