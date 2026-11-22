import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";

// A simple product or one variant, never a bare parent: it owns neither the price nor the stock.
export interface SellableItem {
  product: Product;
  variant: Variant | null;
}

// A code naming the variant itself asks nothing; a parent code still needs a choice.
export type PickerSource = "search" | "code";

// How the sale leaves the counter: handed over now, or sent over WhatsApp.
export type SaleChannel = "STORE" | "WHATSAPP";

// Paid in full now, or owed by a named customer.
export type SalePayment = "paid" | "credit";

// The cart's three choices; a gift owes nothing, so it ignores the payment choice.
export interface CheckoutChoice {
  channel: SaleChannel;
  payment: SalePayment;
  gift: boolean;
}
