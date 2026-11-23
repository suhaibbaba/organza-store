import type { CustomerSuggestion, ExchangePreview, Order, OrderSummary } from "@store/shared/types/order";
import type { Pagination } from "@store/shared/types/common";
import type { CreateOrderInput, ExchangeOrderInput, ReturnOrderItemInput } from "@store/shared/schemas/order";
import { SALE_ORDER_TYPE } from "@store/shared/constants/order";
import { apiFetch } from "@/lib/api/client";
import { EXCHANGE_HISTORY_PAGE_SIZE } from "@/constants/exchange";
import type { ExchangeSearch } from "@/types/exchange";

// STORE opens COMPLETED with stock deducted; WHATSAPP opens NEW. Neither sends a total: the backend prices it.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}

// No Customer table: snapshots from past orders, capped and newest-first by the backend.
export async function fetchCustomerSuggestions(query: string): Promise<CustomerSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const { data } = await apiFetch<CustomerSuggestion[]>(`/api/orders/customer-suggestions?${params.toString()}`);
  return data;
}

// Sales only (a gift is never exchanged), newest first; nothing typed = the recent history.
export async function searchSalesForExchange(
  search: ExchangeSearch,
  page: number,
): Promise<{ orders: OrderSummary[]; meta: Pagination | null }> {
  const params = new URLSearchParams({
    type: SALE_ORDER_TYPE,
    page: String(page),
    pageSize: String(EXCHANGE_HISTORY_PAGE_SIZE),
  });
  if (search.q) {
    params.set("q", search.q);
  }
  if (search.itemCode) {
    params.set("itemCode", search.itemCode);
  }
  const { data, meta } = await apiFetch<OrderSummary[]>(`/api/orders?${params.toString()}`);
  return { orders: data, meta };
}

export async function fetchOrder(id: string): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${id}`);
  return data;
}

export async function previewExchange(orderId: string, returnItems: ReturnOrderItemInput[]): Promise<ExchangePreview> {
  const { data } = await apiFetch<ExchangePreview>(`/api/orders/${orderId}/exchange/preview`, {
    method: "POST",
    body: { returnItems },
  });
  return data;
}

// Returns the NEW order holding the new pieces; the backend prices it and settles the difference.
export async function exchangeOrder(orderId: string, input: ExchangeOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>(`/api/orders/${orderId}/exchange`, { method: "POST", body: input });
  return data;
}
