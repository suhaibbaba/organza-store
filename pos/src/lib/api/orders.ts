import type { CustomerSuggestion, Order } from "@store/shared/types/order";
import type { CreateOrderInput } from "@store/shared/schemas/order";
import { apiFetch } from "@/lib/api/client";

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
