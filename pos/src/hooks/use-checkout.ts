import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput } from "@organza/shared/schemas/order";
import { GIFT_ORDER_CHANNEL, GIFT_ORDER_TYPE, SALE_ORDER_TYPE } from "@organza/shared/constants/order";
import {
  PRODUCT_BROWSE_QUERY_KEY,
  PRODUCT_DETAIL_QUERY_KEY,
  PRODUCT_LOOKUP_QUERY_KEY,
  PRODUCT_SEARCH_QUERY_KEY,
} from "@/constants/api";
import { POS_ORDER_CHANNEL, POS_PAYMENT_METHOD, WHATSAPP_ORDER_CHANNEL } from "@/constants/pos";
import { createOrder } from "@/lib/api/orders";
import { toOrderItems } from "@/lib/cart";
import { toCustomerFields } from "@/lib/customer";
import type { CartLine, DiscountState } from "@/types/cart";
import type { OrderCustomerDraft } from "@/types/customer";

interface CheckoutInput {
  lines: readonly CartLine[];
  orderDiscount: DiscountState;
  // Present = the cart is being filed as a WhatsApp order for delivery;
  // absent = it is a counter sale, handed over there and then.
  customer?: OrderCustomerDraft;
  // Present = the cart is being GIVEN AWAY rather than sold (spec.md
  // "Gifts"). Never combined with a customer: a gift is handed over at the
  // counter in person, and the backend refuses one on any other channel
  // (ORDER_GIFT_CHANNEL_INVALID). The string is the optional "who for / why"
  // note, empty when the cashier didn't write one.
  gift?: { note: string };
}

// Rings the open cart up. The request carries ids, quantities and discounts
// only — the backend prices the order and opens it in the right state for
// its channel: a STORE sale completes immediately with stock deducted inside
// the transaction, while a WHATSAPP order opens NEW and commits nothing
// until someone starts preparing it (spec.md "Stock deduction").
//
// A gift takes the counter path too — same channel, same immediate stock
// deduction, same audit entry — and differs only in what it is: `type: GIFT`,
// which is what makes the backend re-price every line at zero and keep the
// order out of sales. Nothing about the pricing is decided here; the client
// never sends money.
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lines, orderDiscount, customer, gift }: CheckoutInput) => {
      const isGift = gift !== undefined;
      const note = gift?.note.trim() ?? "";

      const input: CreateOrderInput = {
        channel: isGift ? GIFT_ORDER_CHANNEL : customer ? WHATSAPP_ORDER_CHANNEL : POS_ORDER_CHANNEL,
        // Money in, unless the shop is giving this away. Asking for GIFT is
        // only asking: order.createGift is Admin/Manager and enforced on the
        // backend, so an Employee who got this far is refused there
        // (CLAUDE.md rule 5).
        type: isGift ? GIFT_ORDER_TYPE : SALE_ORDER_TYPE,
        paymentMethod: POS_PAYMENT_METHOD,
        items: toOrderItems(lines),
        ...(customer ? toCustomerFields(customer) : {}),
        // Omitted rather than sent empty: the create schema wants a non-empty
        // string when the key is present, so "" would fail where "not given"
        // is fine.
        ...(isGift && note ? { note } : {}),
        // A discount off nothing is nothing. The backend drops a gift's
        // discounts anyway; not sending them keeps the request honest about
        // what was asked for.
        ...(!isGift && orderDiscount.type && orderDiscount.value
          ? { discountType: orderDiscount.type, discountValue: orderDiscount.value }
          : {}),
      };
      return createOrder(input);
    },
    onSuccess: (order) => {
      // A counter sale just took those pieces off the shelf, so every cached
      // product view is now overstating stock — the next scan or search has
      // to re-read it, or the following customer could be sold air. A gift
      // took the same stock off the same shelf and is caught by the same
      // test. A WhatsApp order holds nothing yet, so its caches are left
      // alone.
      if (order.stockDeductedAt === null) return;
      void queryClient.invalidateQueries({ queryKey: PRODUCT_SEARCH_QUERY_KEY });
      // The browser's grid shows the same stock badges as the search list and
      // was being left out of this, so a drawer opened straight after a sale
      // showed the counts from before it.
      void queryClient.invalidateQueries({ queryKey: PRODUCT_BROWSE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_DETAIL_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_LOOKUP_QUERY_KEY });
    },
  });
}
