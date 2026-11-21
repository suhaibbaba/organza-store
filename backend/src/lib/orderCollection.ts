import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lineView } from "@/lib/reports";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { MONEY_DECIMAL_PLACES } from "@/constants";
import { COLLECTION_OVERDUE_DAYS, FINISHED_ORDER_STATUSES } from "@store/shared/constants/order";
import { MS_PER_DAY } from "@store/shared/constants/time";
import type { CollectionSummary, CollectionSummaryRow } from "@/types";

// Net of returns and cancellations, from the same per-line view as the reports, and unbounded in time (spec.md "Payment collection").
export async function queryCollectionSummary(): Promise<CollectionSummaryRow | undefined> {
  const shipped = Prisma.join(FINISHED_ORDER_STATUSES.map((status) => Prisma.sql`${status}::"OrderStatus"`));
  const overdueSince = new Date(Date.now() - COLLECTION_OVERDUE_DAYS * MS_PER_DAY);
  const rows = await prisma.$queryRaw<CollectionSummaryRow[]>`
    WITH line AS (${lineView(null)}),
    owed AS (
      SELECT l.order_id, MIN(l.created_at) AS created_at, (o.status IN (${shipped})) AS shipped,
             SUM(l.unit_net_price * l.net_units) AS amount
      FROM line l JOIN "Order" o ON o.id = l.order_id
      WHERE l.payment_status = 'PENDING_COLLECTION' AND l.net_units > 0
      GROUP BY l.order_id, o.status
    )
    SELECT
      COUNT(*)                                          AS "orderCount",
      COALESCE(SUM(amount), 0)                          AS "amount",
      MIN(created_at)                                   AS "oldestCreatedAt",
      COUNT(*) FILTER (WHERE shipped)                   AS "withCourierCount",
      COALESCE(SUM(amount) FILTER (WHERE shipped), 0)   AS "withCourierAmount",
      COUNT(*) FILTER (WHERE NOT shipped)               AS "notShippedCount",
      COALESCE(SUM(amount) FILTER (WHERE NOT shipped), 0) AS "notShippedAmount",
      COUNT(*) FILTER (WHERE created_at < ${overdueSince}) AS "overdueCount"
    FROM owed
  `;
  return rows[0];
}

// What each order still owes after partial returns, from the same per-line view as the summary.
export async function queryOutstandingByOrder(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await prisma.$queryRaw<{ orderId: string; amount: Prisma.Decimal | null }[]>`
    WITH line AS (${lineView(null)})
    SELECT order_id AS "orderId", COALESCE(SUM(unit_net_price * net_units), 0) AS amount
    FROM line
    WHERE order_id IN (${Prisma.join(ids)})
    GROUP BY order_id
  `;
  return new Map(rows.map((row) => [row.orderId, moneyText(row.amount)]));
}

const moneyText = (value: Prisma.Decimal | null | undefined) =>
  roundMoney(value === null || value === undefined ? ZERO_MONEY() : money(value)).toFixed(MONEY_DECIMAL_PLACES);

export function toCollectionSummary(row: CollectionSummaryRow | undefined): CollectionSummary {
  return {
    orderCount: Number(row?.orderCount ?? 0),
    amount: moneyText(row?.amount),
    oldestCreatedAt: row?.oldestCreatedAt ? row.oldestCreatedAt.toISOString() : null,
    withCourierCount: Number(row?.withCourierCount ?? 0),
    withCourierAmount: moneyText(row?.withCourierAmount),
    notShippedCount: Number(row?.notShippedCount ?? 0),
    notShippedAmount: moneyText(row?.notShippedAmount),
    overdueCount: Number(row?.overdueCount ?? 0),
  };
}
