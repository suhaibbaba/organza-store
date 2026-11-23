import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/response";
import { orderNetTotal } from "@/lib/orderCredit";
import { roundMoney, ZERO_MONEY, type Money } from "@/lib/money";
import {
  ERROR_CODES,
  EXCHANGE_SETTLEMENT_EVEN,
  EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS,
  EXCHANGE_SETTLEMENTS_SHOP_PAYS,
  EXCHANGEABLE_ORDER_STATUSES,
  GIFT_ORDER_TYPE,
} from "@/constants";
import type { ExchangeSettlement } from "@store/shared/types/order";

// Exchanges (spec.md "Exchanges"): which pieces come back, what they are worth, and whether the settlement fits.

interface ReturnableItem {
  id: string;
  quantity: number;
  returnedQuantity: number;
  lineTotal: Prisma.Decimal;
}

interface ExchangeableOrder {
  status: string;
  type: string;
  deletedAt: Date | null;
  paymentStatus: string;
  onCredit: boolean;
  exchangeOfOrderId: string | null;
  paidAmount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
  items: ReturnableItem[];
}

/** Requested quantities per line, refused past what the customer still has. */
export function resolveReturnLines<T extends ReturnableItem>(
  items: readonly T[],
  requested: readonly { orderItemId: string; quantity: number }[],
): Map<string, number> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const totals = new Map<string, number>();
  for (const entry of requested) {
    if (!byId.has(entry.orderItemId)) {
      throw new AppError(400, ERROR_CODES.ORDER_ITEM_NOT_FOUND);
    }
    totals.set(entry.orderItemId, (totals.get(entry.orderItemId) ?? 0) + entry.quantity);
  }
  // Checked on the sum, so two entries for one line cannot add up past what was sold.
  for (const [itemId, quantity] of totals) {
    const item = byId.get(itemId)!;
    if (quantity > item.quantity - item.returnedQuantity) {
      throw new AppError(400, ERROR_CODES.ORDER_RETURN_QUANTITY_EXCEEDED);
    }
  }
  return totals;
}

/** A finished sale whose money the shop holds or is owed on account; a gift or a courier parcel not yet paid is not. */
export function assertExchangeable(order: ExchangeableOrder): void {
  const finished = (EXCHANGEABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
  if (!finished || order.deletedAt || order.type === GIFT_ORDER_TYPE || order.paymentStatus === "PENDING_COLLECTION") {
    throw new AppError(409, ERROR_CODES.ORDER_NOT_EXCHANGEABLE);
  }
}

/** Orders whose money is followed payment by payment rather than by their total. */
export function isPaymentTracked(order: { onCredit: boolean; exchangeOfOrderId: string | null }): boolean {
  return order.onCredit || order.exchangeOfOrderId !== null;
}

/** What the pieces were sold for, net of every discount; on an account only what was actually paid for them carries over. */
export function exchangeCredit(order: ExchangeableOrder, returned: Map<string, number>): Money {
  const after = {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      returnedQuantity: item.returnedQuantity + (returned.get(item.id) ?? 0),
    })),
  };
  const netBefore = orderNetTotal(order);
  const netAfter = orderNetTotal(after);
  const value = roundMoney(netBefore.sub(netAfter));
  if (!isPaymentTracked(order)) {
    return value;
  }
  // Paid beyond what the kept pieces are worth is what was paid for these; a debt still owed is simply reduced.
  const paidFor = roundMoney(order.paidAmount.sub(netAfter));
  if (paidFor.lessThanOrEqualTo(0)) {
    return ZERO_MONEY();
  }
  return paidFor.lessThan(value) ? paidFor : value;
}

/** EVEN when nothing changes hands; otherwise the settlement must be one for the side that owes. */
export function resolveSettlement(difference: Money, requested: ExchangeSettlement): ExchangeSettlement {
  if (difference.isZero()) {
    return EXCHANGE_SETTLEMENT_EVEN;
  }
  const allowed: readonly string[] = difference.greaterThan(0)
    ? EXCHANGE_SETTLEMENTS_CUSTOMER_PAYS
    : EXCHANGE_SETTLEMENTS_SHOP_PAYS;
  if (!allowed.includes(requested)) {
    throw new AppError(400, ERROR_CODES.ORDER_EXCHANGE_SETTLEMENT_INVALID);
  }
  return requested;
}

/** Cash that changes hands now: the difference paid in, or paid back out of the drawer. */
export function exchangeCashMovement(difference: Money, settlement: ExchangeSettlement): Money {
  if (settlement === "PAID" || settlement === "REFUNDED") {
    return roundMoney(difference);
  }
  return ZERO_MONEY();
}
