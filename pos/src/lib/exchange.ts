import {
  EXCHANGE_SETTLEMENT_EVEN,
  EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS,
  EXCHANGE_SETTLEMENTS_SHOP_PAYS,
  EXCHANGEABLE_ORDER_STATUSES,
  GIFT_ORDER_TYPE,
} from "@store/shared/constants/order";
import type { ReturnOrderItemInput } from "@store/shared/schemas/order";
import type { ExchangeSettlement, Order, OrderItem, OrderSummary } from "@store/shared/types/order";
import { fromCents, toCents } from "@/lib/money";
import { EXCHANGE_CODE_MIN_DIGITS, EXCHANGE_SKU_PATTERN } from "@/constants/exchange";
import type { CartLine } from "@/types/cart";
import type { ExchangeReturnLine, ExchangeSearch, ExchangeSide } from "@/types/exchange";

// Pure exchange maths and rules for the till; the backend decides the real credit and refuses anything else.

// Same gate as the backend's assertExchangeable, so a row that would be refused is greyed out instead.
export function isExchangeable(order: Pick<OrderSummary, "status" | "type" | "paymentStatus">): boolean {
  return (
    (EXCHANGEABLE_ORDER_STATUSES as readonly string[]).includes(order.status) &&
    order.type !== GIFT_ORDER_TYPE &&
    order.paymentStatus !== "PENDING_COLLECTION"
  );
}

export function returnableQuantity(item: Pick<OrderItem, "quantity" | "returnedQuantity">): number {
  return Math.max(0, item.quantity - item.returnedQuantity);
}

// What one piece was really sold for: its line share of the sale's total, every discount applied.
export function unitPaid(order: Pick<Order, "subtotal" | "total">, item: Pick<OrderItem, "lineTotal" | "quantity">) {
  const subtotal = toCents(order.subtotal);
  const ratio = subtotal === 0 ? 1 : toCents(order.total) / subtotal;
  return fromCents(Math.round((toCents(item.lineTotal) / Math.max(1, item.quantity)) * ratio));
}

// A long run of digits or a SKU is a piece's code; anything else is an order number, a name or a phone.
export function classifyExchangeSearch(text: string): ExchangeSearch {
  const value = text.trim();
  if (!value) {
    return {};
  }
  const isBarcode = /^\d+$/.test(value) && value.length >= EXCHANGE_CODE_MIN_DIGITS;
  return isBarcode || EXCHANGE_SKU_PATTERN.test(value) ? { itemCode: value } : { q: value };
}

export function toReturnItems(returns: readonly ExchangeReturnLine[]): ReturnOrderItemInput[] {
  return returns
    .filter((line) => line.quantity > 0)
    .map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity }));
}

export function returnedPieceCount(returns: readonly ExchangeReturnLine[]): number {
  return returns.reduce((sum, line) => sum + line.quantity, 0);
}

// Positive = the customer owes the shop; negative = the shop owes the customer.
export function exchangeDifferenceCents(cartTotal: string, credit: string): number {
  return toCents(cartTotal) - toCents(credit);
}

export function exchangeSide(differenceCents: number): ExchangeSide {
  if (differenceCents > 0) {
    return "customer";
  }
  return differenceCents < 0 ? "shop" : "even";
}

// Owing it as a debt is a credit sale, so it is offered only with order.sellOnCredit.
export function settlementsFor(side: ExchangeSide, canCredit: boolean): ExchangeSettlement[] {
  if (side === "even") {
    return [EXCHANGE_SETTLEMENT_EVEN];
  }
  const options: readonly ExchangeSettlement[] =
    side === "customer" ? EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS : EXCHANGE_SETTLEMENTS_SHOP_PAYS;
  return options.filter((option) => canCredit || option !== "DEBT");
}

// A typed piece has no catalogue entry to put back on the shelf against, so an exchange takes catalogue pieces only.
export function hasQuickSellLines(lines: readonly CartLine[]): boolean {
  return lines.some((line) => line.quickSell !== null);
}
