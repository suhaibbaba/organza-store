import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { OrderStatus } from "@store/shared/types/order";
import type {
  CreateOrderInput,
  ExchangeOrderInput,
  ReturnOrderInput,
  ReturnOrderItemInput,
} from "@store/shared/schemas/order";
import {
  ORDER_COLLECTION_SUMMARY_QUERY_KEY,
  ORDER_DETAIL_QUERY_KEY,
  ORDER_EXCHANGE_PREVIEW_QUERY_KEY,
  ORDER_LIST_QUERY_KEY,
} from "@/constants/orders";
import {
  collectOrders,
  createOrder,
  deleteOrder,
  exchangeOrder,
  fetchCollectionSummary,
  fetchOrder,
  fetchOrders,
  previewExchange,
  resolveMapLink,
  returnOrder,
  updateOrderStatus,
} from "@/lib/api/orders";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import type { OrderListFilters } from "@/types/order";

export function useOrdersQuery(filters: OrderListFilters) {
  return useQuery({
    queryKey: [ORDER_LIST_QUERY_KEY, filters],
    queryFn: () => fetchOrders(filters),
    placeholderData: keepPreviousData,
  });
}

export function useOrderQuery(id: string) {
  return useQuery({
    queryKey: [ORDER_DETAIL_QUERY_KEY, id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  });
}

// Refreshed by every order mutation: creating, cancelling, returning and collecting all change it.
export function useCollectionSummaryQuery() {
  return useQuery({
    queryKey: ORDER_COLLECTION_SUMMARY_QUERY_KEY,
    queryFn: fetchCollectionSummary,
  });
}

function useInvalidateOrders() {
  const { ordersChanged } = useCacheInvalidation();
  return ordersChanged;
}

export function useCreateOrderMutation() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: (order) => invalidate(order.id),
  });
}

export function useResolveMapLinkMutation() {
  return useMutation({ mutationFn: (url: string) => resolveMapLink({ url }) });
}

// Cancelling goes through the same endpoint but needs order.cancel, checked by the backend.
export function useUpdateOrderStatusMutation(id: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(id, status),
    onSuccess: () => invalidate(id),
  });
}

export function useReturnOrderMutation(id: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (input: ReturnOrderInput) => returnOrder(id, input),
    onSuccess: () => invalidate(id),
  });
}

// The server's figure for what the chosen pieces carry over; nothing chosen asks nothing.
export function useExchangePreviewQuery(id: string, returnItems: ReturnOrderItemInput[]) {
  return useQuery({
    queryKey: [ORDER_EXCHANGE_PREVIEW_QUERY_KEY, id, returnItems],
    queryFn: () => previewExchange(id, { returnItems }),
    enabled: returnItems.length > 0,
    placeholderData: keepPreviousData,
  });
}

// Both orders change: the original takes its pieces back, the new one is created.
export function useExchangeOrderMutation(id: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (input: ExchangeOrderInput) => exchangeOrder(id, input),
    onSuccess: (order) => invalidate([id, order.id]),
  });
}

export function useCollectOrdersMutation() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (orderIds: string[]) => collectOrders(orderIds),
    onSuccess: (_result, orderIds) => invalidate(orderIds),
  });
}

export function useDeleteOrderMutation(id: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: () => deleteOrder(id),
    onSuccess: () => invalidate(id),
  });
}
