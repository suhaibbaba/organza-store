import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput } from "@store/shared/schemas/order";
import { GIFT_ORDER_CHANNEL, GIFT_ORDER_TYPE, SALE_ORDER_TYPE } from "@store/shared/constants/order";
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
  // Present = filed as a WhatsApp order for delivery; absent = a counter sale handed over there and then.
  customer?: OrderCustomerDraft;
  // Present = the cart is GIVEN AWAY at the counter (spec.md "Gifts"); the string is the optional "who for / why" note.
  gift?: { note: string };
}

// Sends ids, quantities and discounts only — the backend prices the order (a gift at zero); the client never sends money.
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lines, orderDiscount, customer, gift }: CheckoutInput) => {
      const isGift = gift !== undefined;
      const note = gift?.note.trim() ?? "";

      const input: CreateOrderInput = {
        channel: isGift ? GIFT_ORDER_CHANNEL : customer ? WHATSAPP_ORDER_CHANNEL : POS_ORDER_CHANNEL,
        // Asking for GIFT is only asking: order.createGift is enforced on the backend (CLAUDE.md rule 5).
        type: isGift ? GIFT_ORDER_TYPE : SALE_ORDER_TYPE,
        paymentMethod: POS_PAYMENT_METHOD,
        items: toOrderItems(lines),
        ...(customer ? toCustomerFields(customer) : {}),
        // Omitted rather than sent empty: the schema refuses "" where "not given" is fine.
        ...(isGift && note ? { note } : {}),
        // A discount off nothing is nothing; the backend drops a gift's discounts anyway.
        ...(!isGift && orderDiscount.type && orderDiscount.value
          ? { discountType: orderDiscount.type, discountValue: orderDiscount.value }
          : {}),
      };
      return createOrder(input);
    },
    onSuccess: (order) => {
      // Stock left the shelf (sale or gift), so cached product views overstate it; a WhatsApp order holds nothing yet.
      if (order.stockDeductedAt === null) {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: PRODUCT_SEARCH_QUERY_KEY });
      // The browser's grid shows the same stock badges, so it must be refreshed too.
      void queryClient.invalidateQueries({ queryKey: PRODUCT_BROWSE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_DETAIL_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_LOOKUP_QUERY_KEY });
    },
  });
}
