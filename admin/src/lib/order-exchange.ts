import { EXCHANGE_SETTLEMENT_EVEN, EXCHANGEABLE_ORDER_STATUSES, SALE_ORDER_TYPE } from "@store/shared/constants/order";
import type { ExchangeSettlement, Order } from "@store/shared/types/order";
import type { ReturnOrderItemInput } from "@store/shared/schemas/order";
import { fromCents, toCents } from "@/lib/money";
import type { ExchangeSide, ReturnQuantities } from "@/types/order";

// Same rule as the backend's assertExchangeable: a finished sale whose money is in hand or on account.
export function isOrderExchangeable(order: Order): boolean {
  return (
    (EXCHANGEABLE_ORDER_STATUSES as readonly string[]).includes(order.status) &&
    order.type === SALE_ORDER_TYPE &&
    order.paymentStatus !== "PENDING_COLLECTION" &&
    order.items.some((item) => item.quantity > item.returnedQuantity)
  );
}

export function toReturnItems(quantities: ReturnQuantities): ReturnOrderItemInput[] {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

// Positive = the customer owes the shop; a waived or kept difference is settled on the server, never here.
export function exchangeDifferenceCents(newTotal: string, credit: string): number {
  return toCents(newTotal) - toCents(credit);
}

export function exchangeSide(differenceCents: number): ExchangeSide {
  if (differenceCents === 0) {
    return "even";
  }
  return differenceCents > 0 ? "customer" : "shop";
}

export function differenceAmount(differenceCents: number): string {
  return fromCents(Math.abs(differenceCents));
}

export function settlementFor(
  side: ExchangeSide,
  customerPays: ExchangeSettlement,
  shopPays: ExchangeSettlement,
): ExchangeSettlement {
  if (side === "even") {
    return EXCHANGE_SETTLEMENT_EVEN;
  }
  return side === "customer" ? customerPays : shopPays;
}
