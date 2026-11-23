import type { I18n } from "@store/shared/types/common";
import type { ExchangeSettlement, Order } from "@store/shared/types/order";

// One piece line coming back, copied from the original sale for display.
export interface ExchangeReturnLine {
  orderItemId: string;
  quantity: number;
  name: I18n;
  variantName: I18n | null;
  thumbnailUrl: string | null;
}

// The sale pieces are coming back from, and which; the cart holds the new pieces.
export interface ExchangeDraft {
  order: Order;
  returns: ExchangeReturnLine[];
}

// Who owes whom once the new pieces are totalled against what came back.
export type ExchangeSide = "customer" | "shop" | "even";

// How the original sale is being looked for: typed (number, name, phone) or a piece's code.
export interface ExchangeSearch {
  q?: string;
  itemCode?: string;
}

// What the success screen says about the difference.
export interface ExchangeOutcome {
  difference: string;
  settlement: ExchangeSettlement;
}

// What the cart shows while it holds the new pieces of an exchange.
export interface ExchangeCartState {
  orderNumber: number;
  returns: readonly ExchangeReturnLine[];
  // Null while the backend is still counting it.
  credit: string | null;
  onEdit: () => void;
  onCancel: () => void;
}
