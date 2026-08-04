import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@shared/types/order";
import type { CreateOrderInput, ReturnOrderInput } from "@shared/schemas/order";
import { ORDER_DETAIL_QUERY_KEY, ORDER_LIST_PAGE_SIZE, ORDER_LIST_QUERY_KEY } from "@/constants/orders";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import { DASHBOARD_SUMMARY_QUERY_KEY } from "@/constants/api";
import { createOrder, deleteOrder, fetchOrder, fetchOrders, returnOrder, updateOrderStatus } from "@/lib/api/orders";
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

// Every order mutation can move stock: creating deducts it (STORE) or commits
// it later (online), advancing to PREPARING deducts it, and cancelling,
// returning or deleting puts it back. So each of them invalidates the
// catalogue views as well as the order itself — otherwise the products and
// inventory screens keep showing quantities that are no longer true.
function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: [ORDER_LIST_QUERY_KEY] });
    if (id) void queryClient.invalidateQueries({ queryKey: [ORDER_DETAIL_QUERY_KEY, id] });
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
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

export function useDeleteOrderMutation(id: string) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: () => deleteOrder(id),
    onSuccess: () => invalidate(id),
  });
}
