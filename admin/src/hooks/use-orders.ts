import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@shared/types/order";
import type { CreateOrderInput, ReturnOrderInput } from "@shared/schemas/order";
import {
  ORDER_COLLECTION_SUMMARY_QUERY_KEY,
  ORDER_DETAIL_QUERY_KEY,
  ORDER_LIST_PAGE_SIZE,
  ORDER_LIST_QUERY_KEY,
} from "@/constants/orders";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import { DASHBOARD_SUMMARY_QUERY_KEY } from "@/constants/api";
import { REPORTS_SALES_QUERY_KEY, REPORTS_SUMMARY_QUERY_KEY } from "@/constants/reports";
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

// Every order mutation can move stock: creating deducts it (STORE) or commits
// it later (online), advancing to PREPARING deducts it, and cancelling,
// returning or deleting puts it back. So each of them invalidates the
// catalogue views as well as the order itself — otherwise the products and
// inventory screens keep showing quantities that are no longer true.
// The same goes for the sales figures: a new sale, a cancellation or a
// return all change what the dashboard and the reports should be showing.
function useInvalidateOrders() {
  const queryClient = useQueryClient();
  // Takes one id or a whole batch (settling several orders at once), so every
  // detail screen behind the action refreshes too.
  return (id?: string | string[]) => {
    void queryClient.invalidateQueries({ queryKey: [ORDER_LIST_QUERY_KEY] });
    for (const one of id === undefined ? [] : Array.isArray(id) ? id : [id]) {
      void queryClient.invalidateQueries({ queryKey: [ORDER_DETAIL_QUERY_KEY, one] });
    }
    void queryClient.invalidateQueries({ queryKey: ORDER_COLLECTION_SUMMARY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: REPORTS_SUMMARY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: [REPORTS_SALES_QUERY_KEY] });
  };
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
