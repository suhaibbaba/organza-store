import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput } from "@shared/schemas/order";
import { PRODUCT_DETAIL_QUERY_KEY, PRODUCT_LOOKUP_QUERY_KEY, PRODUCT_SEARCH_QUERY_KEY } from "@/constants/api";
import { POS_ORDER_CHANNEL, POS_PAYMENT_METHOD } from "@/constants/pos";
import { createOrder } from "@/lib/api/orders";
import { toOrderItems } from "@/lib/cart";
import type { CartLine, DiscountState } from "@/types/cart";

// Rings up the open cart as a STORE sale. The request carries ids,
// quantities and discounts only — the backend prices the order, deducts the
// stock inside its transaction, and opens it COMPLETED.
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lines, orderDiscount }: { lines: readonly CartLine[]; orderDiscount: DiscountState }) => {
      const input: CreateOrderInput = {
        channel: POS_ORDER_CHANNEL,
        paymentMethod: POS_PAYMENT_METHOD,
        items: toOrderItems(lines),
        ...(orderDiscount.type && orderDiscount.value
          ? { discountType: orderDiscount.type, discountValue: orderDiscount.value }
          : {}),
      };
      return createOrder(input);
    },
    onSuccess: () => {
      // The sale just took those pieces off the shelf, so every cached
      // product view is now overstating stock — the next scan or search has
      // to re-read it, or the following customer could be sold air.
      void queryClient.invalidateQueries({ queryKey: PRODUCT_SEARCH_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_DETAIL_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_LOOKUP_QUERY_KEY });
    },
  });
}
