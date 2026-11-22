import { Prisma } from "@prisma/client";
import { money, roundMoney, ZERO_MONEY, type Money } from "@/lib/money";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { PaymentStatus } from "@/types";

// Credit sales (spec.md "Customers and selling on credit"): what an order is worth now, what was paid, what is owed.

interface NetTotalOrder {
  status: string;
  deletedAt: Date | null;
  subtotal: Prisma.Decimal;
  total: Prisma.Decimal;
  items: { lineTotal: Prisma.Decimal; quantity: number; returnedQuantity: number }[];
}

// The same arithmetic as the reports' per-line view, so a balance and a report never disagree; zero once cancelled or deleted.
export function orderNetTotal(order: NetTotalOrder): Money {
  if (order.status === "CANCELLED" || order.deletedAt) {
    return ZERO_MONEY();
  }
  const ratio = order.subtotal.isZero() ? money(1) : order.total.div(order.subtotal);
  const net = order.items.reduce(
    (sum, item) => sum.add(item.lineTotal.div(item.quantity).mul(item.quantity - item.returnedQuantity)),
    ZERO_MONEY(),
  );
  return roundMoney(net.mul(ratio));
}

export function orderBalance(order: NetTotalOrder & { paidAmount: Prisma.Decimal }): Money {
  const owed = orderNetTotal(order).sub(order.paidAmount);
  return owed.lessThan(0) ? ZERO_MONEY() : roundMoney(owed);
}

// Paid off ⇒ COLLECTED at that moment; otherwise ON_CREDIT. A collectedAt already set is kept, not moved.
function settledState(paid: Money, net: Money, at: Date, collectedAt: Date | null) {
  const settled = paid.greaterThanOrEqualTo(net);
  return {
    paymentStatus: (settled ? "COLLECTED" : "ON_CREDIT") as PaymentStatus,
    collectedAt: settled ? (collectedAt ?? at) : null,
  };
}

type CreditOrder = NetTotalOrder & {
  id: string;
  onCredit: boolean;
  paidAmount: Prisma.Decimal;
  collectedAt: Date | null;
  paymentStatus: string;
};

export interface PaymentRecorded {
  paymentId: string;
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  paymentStatus: PaymentStatus;
}

// The order must already be row-locked by the caller; never takes the paid amount past what is owed.
export async function recordOrderPayment(
  tx: Prisma.TransactionClient,
  order: CreditOrder,
  input: { amount: Money; note?: string | null; userId: string; at: Date },
): Promise<PaymentRecorded> {
  if (!order.onCredit || order.status === "CANCELLED" || order.deletedAt) {
    throw new AppError(409, ERROR_CODES.ORDER_NOT_ON_CREDIT);
  }
  const balanceBefore = orderBalance(order);
  const amount = roundMoney(input.amount);
  if (amount.lessThanOrEqualTo(0) || amount.greaterThan(balanceBefore)) {
    throw new AppError(400, ERROR_CODES.ORDER_PAYMENT_EXCEEDS_BALANCE);
  }

  const payment = await tx.orderPayment.create({
    data: { orderId: order.id, amount, note: input.note ?? null, receivedById: input.userId, receivedAt: input.at },
  });
  const paid = roundMoney(order.paidAmount.add(amount));
  const state = settledState(paid, orderNetTotal(order), input.at, order.collectedAt);
  await tx.order.update({ where: { id: order.id }, data: { paidAmount: paid, ...state } });

  return {
    paymentId: payment.id,
    amount,
    balanceBefore,
    balanceAfter: roundMoney(balanceBefore.sub(amount)),
    paymentStatus: state.paymentStatus,
  };
}

export interface CreditReconciled {
  refund: Money | null;
  paymentStatus: PaymentStatus;
}

// After a cancel, return, delete or re-discount: pays back what was paid beyond the order's new worth, then re-settles.
export async function reconcileCredit(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
): Promise<CreditReconciled | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { lineTotal: true, quantity: true, returnedQuantity: true } } },
  });
  if (!order || !order.onCredit) {
    return null;
  }

  const net = orderNetTotal(order);
  const at = new Date();
  let paid = order.paidAmount;
  let refund: Money | null = null;

  if (paid.greaterThan(net)) {
    refund = roundMoney(paid.sub(net));
    await tx.orderPayment.create({
      data: { orderId: order.id, amount: refund.negated(), receivedById: userId, receivedAt: at },
    });
    paid = net;
  }

  const state = settledState(paid, net, at, order.collectedAt);
  await tx.order.update({ where: { id: order.id }, data: { paidAmount: paid, ...state } });
  return { refund, paymentStatus: state.paymentStatus };
}

// What a cancel or delete would pay back, for the confirmation before it happens.
export function refundOnUndo(order: { onCredit: boolean; paidAmount: Prisma.Decimal }): Money {
  return order.onCredit ? roundMoney(order.paidAmount) : ZERO_MONEY();
}
