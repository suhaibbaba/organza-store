import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderInput } from "@shared/schemas/order";
import { SALE_ORDER_TYPE } from "@shared/constants/order";
import { PRODUCT_DETAIL_QUERY_KEY, PRODUCT_LOOKUP_QUERY_KEY, PRODUCT_SEARCH_QUERY_KEY } from "@/constants/api";
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
}

// Rings the open cart up. The request carries ids, quantities and discounts
// only — the backend prices the order and opens it in the right state for
// its channel: a STORE sale completes immediately with stock deducted inside
// the transaction, while a WHATSAPP order opens NEW and commits nothing
// until someone starts preparing it (spec.md "Stock deduction").
export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ lines, orderDiscount, customer }: CheckoutInput) => {
      const input: CreateOrderInput = {
        channel: customer ? WHATSAPP_ORDER_CHANNEL : POS_ORDER_CHANNEL,
        // Money in. Giving stock away is a GIFT order — a separate,
        // Admin/Manager-only action, not something a cart can turn into.
        type: SALE_ORDER_TYPE,
        paymentMethod: POS_PAYMENT_METHOD,
        items: toOrderItems(lines),
        ...(customer ? toCustomerFields(customer) : {}),
        ...(orderDiscount.type && orderDiscount.value
          ? { discountType: orderDiscount.type, discountValue: orderDiscount.value }
          : {}),
      };
      return createOrder(input);
    },
    onSuccess: (order) => {
      // A counter sale just took those pieces off the shelf, so every cached
      // product view is now overstating stock — the next scan or search has
      // to re-read it, or the following customer could be sold air. A
      // WhatsApp order holds nothing yet, so its caches are left alone.
      if (order.stockDeductedAt === null) return;
      void queryClient.invalidateQueries({ queryKey: PRODUCT_SEARCH_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_DETAIL_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PRODUCT_LOOKUP_QUERY_KEY });
    },
  });
}
