import type { Order } from "@shared/types/order";
import type { CreateOrderInput } from "@shared/schemas/order";
import { apiFetch } from "@/lib/api/client";

// A POS sale is a STORE order: it opens COMPLETED with stock already
// deducted and its money already collected — cash in hand at the counter
// (spec.md "Phase 2: Orders") — needs no customer details, and carries no
// total, because the backend prices it.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}
