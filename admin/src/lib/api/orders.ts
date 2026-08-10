import type {
  CollectResult,
  CollectionSummary,
  Order,
  OrderStatus,
  OrderSummary,
} from "@organza/shared/types/order";
import type { Pagination } from "@organza/shared/types/common";
import type { CreateOrderInput, ReturnOrderInput } from "@organza/shared/schemas/order";
import { apiFetch } from "@/lib/api/client";
import type { OrderListFilters } from "@/types/order";

// The API takes an inclusive range over `createdAt` as datetimes, while the
// filter sheet collects plain dates. "To 5 August" has to mean the whole of
// the 5th, so the end of the range is stretched to the last instant of that
// day — otherwise picking today as both ends would match nothing.
function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString();
}

function buildOrderListQuery(filters: OrderListFilters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  if (filters.collectableOnly) params.set("collectableOnly", "true");
  if (filters.dateFrom) params.set("dateFrom", startOfDayIso(filters.dateFrom));
  if (filters.dateTo) params.set("dateTo", endOfDayIso(filters.dateTo));
  return params.toString();
}

export async function fetchOrders(
  filters: OrderListFilters,
  pageSize: number
): Promise<{ orders: OrderSummary[]; meta: Pagination | null }> {
  const query = buildOrderListQuery(filters, pageSize);
  const { data, meta } = await apiFetch<OrderSummary[]>(`/api/orders?${query}`);
  return { orders: data, meta };
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}`);
  return data;
}

// Carries ids, quantities, discounts and the customer snapshot only — the
// backend prices the order and decides its opening status.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: { status } });
  return data;
}

// Omitting `items` returns the whole order; passing them returns specific
// lines partially. Stock is restored server-side either way.
export async function returnOrder(id: string, input: ReturnOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}/return`, { method: "POST", body: input });
  return data;
}

// What the delivery company still owes the shop, across every date. Net of
// returns and free of cancelled sales, so it matches the reports figure.
export async function fetchCollectionSummary(): Promise<CollectionSummary> {
  const { data } = await apiFetch<CollectionSummary>("/api/orders/collection-summary");
  return data;
}

// Records that the delivery company has paid for these orders. One id or a
// whole batch — the shop is normally handed several at once. Marking an
// already-collected order is a no-op server-side, not an error.
export async function collectOrders(orderIds: string[]): Promise<CollectResult> {
  const { data } = await apiFetch<CollectResult>("/api/orders/collect", {
    method: "POST",
    body: { orderIds },
  });
  return data;
}

// Soft delete — the order is hidden everywhere, never destroyed.
export async function deleteOrder(id: string): Promise<{ id: string; deletedAt: string }> {
  const { data } = await apiFetch<{ id: string; deletedAt: string }>(`/api/orders/${id}`, { method: "DELETE" });
  return data;
}
