import type { CustomerSuggestion, Order } from "@organza/shared/types/order";
import type { CreateOrderInput } from "@organza/shared/schemas/order";
import { apiFetch } from "@/lib/api/client";

// The POS opens two kinds of order from the same cart (see constants/pos.ts):
// a STORE sale, which opens COMPLETED with stock already deducted and its
// money in the till, and a WHATSAPP order, which opens NEW with customer
// details attached. Neither carries a total — the backend prices both.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}

// Customers the shop has served before, matched on the phone digits typed so
// far. There is no Customer entity (spec.md "Customer information"), so these
// are snapshots read back out of past orders — capped and newest-first by the
// backend, which is also where the "how many digits before we look" floor
// lives.
export async function fetchCustomerSuggestions(query: string): Promise<CustomerSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const { data } = await apiFetch<CustomerSuggestion[]>(`/api/orders/customer-suggestions?${params.toString()}`);
  return data;
}
