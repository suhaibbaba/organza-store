import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExchangeOrderInput } from "@store/shared/schemas/order";
import {
  EXCHANGE_ORDERS_QUERY_KEY,
  EXCHANGE_PREVIEW_QUERY_KEY,
  ORDER_DETAIL_QUERY_KEY,
  PRODUCT_BROWSE_QUERY_KEY,
  PRODUCT_DETAIL_QUERY_KEY,
  PRODUCT_LOOKUP_QUERY_KEY,
  PRODUCT_SEARCH_QUERY_KEY,
} from "@/constants/api";
import { exchangeOrder, fetchOrder, previewExchange } from "@/lib/api/orders";
import { toReturnItems } from "@/lib/exchange";
import type { ExchangeReturnLine } from "@/types/exchange";

// The whole sale, fresh each time: another till may have taken some of its pieces back already.
export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: [...ORDER_DETAIL_QUERY_KEY, orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: orderId !== null,
    staleTime: 0,
  });
}

// What the chosen pieces carry over, as the backend will count it; null until something is chosen.
export function useExchangePreview(orderId: string | null, returns: readonly ExchangeReturnLine[]) {
  const items = toReturnItems(returns);
  const result = useQuery({
    queryKey: [...EXCHANGE_PREVIEW_QUERY_KEY, orderId, items],
    queryFn: () => previewExchange(orderId!, items),
    enabled: orderId !== null && items.length > 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
  return { ...result, credit: items.length > 0 ? (result.data?.credit ?? null) : null };
}

// Both sales changed stock, so every cached stock figure is refreshed afterwards.
export function useExchangeCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: ExchangeOrderInput }) => exchangeOrder(orderId, input),
    onSuccess: () => {
      for (const queryKey of [
        PRODUCT_SEARCH_QUERY_KEY,
        PRODUCT_BROWSE_QUERY_KEY,
        PRODUCT_DETAIL_QUERY_KEY,
        PRODUCT_LOOKUP_QUERY_KEY,
        EXCHANGE_ORDERS_QUERY_KEY,
        ORDER_DETAIL_QUERY_KEY,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
