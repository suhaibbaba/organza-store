import type { Order, OrderStatus, OrderSummary } from "@shared/types/order";
import type { Pagination } from "@shared/types/common";
import type { CreateOrderInput, ReturnOrderInput } from "@shared/schemas/order";
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

// Soft delete — the order is hidden everywhere, never destroyed.
export async function deleteOrder(id: string): Promise<{ id: string; deletedAt: string }> {
  const { data } = await apiFetch<{ id: string; deletedAt: string }>(`/api/orders/${id}`, { method: "DELETE" });
  return data;
}
