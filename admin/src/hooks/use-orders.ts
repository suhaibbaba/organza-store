import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { OrderStatus } from "@organza/shared/types/order";
import type { CreateOrderInput, ReturnOrderInput } from "@organza/shared/schemas/order";
import {
  ORDER_COLLECTION_SUMMARY_QUERY_KEY,
  ORDER_DETAIL_QUERY_KEY,
  ORDER_LIST_PAGE_SIZE,
  ORDER_LIST_QUERY_KEY,
} from "@/constants/orders";
import {
  collectOrders,
  createOrder,
  deleteOrder,
  fetchCollectionSummary,
  fetchOrder,
  fetchOrders,
  returnOrder,
  updateOrderStatus,
} from "@/lib/api/orders";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import type { OrderListFilters } from "@/types/order";

export function useOrdersQuery(filters: OrderListFilters) {
  return useQuery({
    queryKey: [ORDER_LIST_QUERY_KEY, filters],
    queryFn: () => fetchOrders(filters, ORDER_LIST_PAGE_SIZE),
    // Keeps the current page's cards on screen while the next page/filter
    // loads, instead of flashing back to a loading state.
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

// What the delivery company still owes. Read on the outstanding-money screen
// and refreshed by every order mutation, since creating, cancelling,
// returning or collecting a sale all change it.
export function useCollectionSummaryQuery() {
  return useQuery({
    queryKey: ORDER_COLLECTION_SUMMARY_QUERY_KEY,
    queryFn: fetchCollectionSummary,
  });
}

// One order write shows up on the order screens, the catalogue (stock moves
// with it) and the sales figures — the whole map lives in
// hooks/use-cache-invalidation.ts.
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

// Advancing an order along the delivery flow. Employees may do this (spec.md:
// "create + mark delivered"); cancelling goes through the same endpoint but
// needs `order.cancel`, which the backend checks separately.
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

// Settling up with the delivery company, for one order or a batch of them.
// Admin/Manager only — the backend enforces it (order.markCollected); the UI
// only decides whether the button exists.
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
