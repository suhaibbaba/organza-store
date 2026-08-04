import type { Order } from "@shared/types/order";
import type { CreateOrderInput } from "@shared/schemas/order";
import { apiFetch } from "@/lib/api/client";

// A POS sale is a STORE order: it opens COMPLETED with stock already
// deducted (spec.md "Phase 2: Orders"), needs no customer details, and
// carries no total — the backend prices it.
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data } = await apiFetch<Order>("/api/orders", { method: "POST", body: input });
  return data;
}
