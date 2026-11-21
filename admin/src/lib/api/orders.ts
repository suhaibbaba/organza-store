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

// "To 5 August" means the whole of the 5th, so the range end is the last instant of that day.
function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString();
}

function buildOrderListQuery(filters: OrderListFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  if (filters.collectableOnly) params.set("collectableOnly", "true");
  if (filters.hasQuickSale) params.set("hasQuickSale", "true");
  if (filters.dateFrom) params.set("dateFrom", startOfDayIso(filters.dateFrom));
  if (filters.dateTo) params.set("dateTo", endOfDayIso(filters.dateTo));
  return params.toString();
}

export async function fetchOrders(
  filters: OrderListFilters
): Promise<{ orders: OrderSummary[]; meta: Pagination | null }> {
  const query = buildOrderListQuery(filters);
  const { data, meta } = await apiFetch<OrderSummary[]>(`/api/orders?${query}`);
  return { orders: data, meta };
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}`);
  return data;
}

// The backend prices the order and decides its opening status.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}/status`, { method: "PATCH", body: { status } });
  return data;
}

// No items = the whole order; stock is restored server-side either way.
export async function returnOrder(id: string, input: ReturnOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}/return`, { method: "POST", body: input });
  return data;
}

// Net of returns and free of cancelled sales, so it matches the reports figure.
export async function fetchCollectionSummary(): Promise<CollectionSummary> {
  const { data } = await apiFetch<CollectionSummary>("/api/orders/collection-summary");
  return data;
}

// Collecting an already-collected order is a no-op server-side, not an error.
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
