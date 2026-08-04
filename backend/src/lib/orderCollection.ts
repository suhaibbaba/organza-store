import { prisma } from "@/lib/prisma";
import { lineView } from "@/lib/reports";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { MONEY_DECIMAL_PLACES } from "@/constants";
import type { CollectionSummary, CollectionSummaryRow } from "@/types";

// ============================================================================
//  Money still sitting with the delivery company (spec.md "Payment
//  collection").
//
//  Deliberately computed from the SAME per-line view the reports use rather
//  than by summing Order.total: an order that was partly sent back owes only
//  what stayed sold, and a cancelled or fully returned one owes nothing at
//  all. Summing totals would quietly overstate the outstanding balance — the
//  exact figure the shop uses to chase a payment.
//
//  Unbounded in time on purpose: an outstanding balance is not a date range,
//  it is everything not yet settled.
// ============================================================================

export async function queryCollectionSummary(): Promise<CollectionSummaryRow | undefined> {
  const rows = await prisma.$queryRaw<CollectionSummaryRow[]>`
    WITH line AS (${lineView(null)})
    SELECT
      COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0) AS "orderCount",
      COALESCE(SUM(unit_net_price * net_units), 0)          AS "amount",
      MIN(created_at) FILTER (WHERE net_units > 0)          AS "oldestCreatedAt"
    FROM line
    WHERE payment_status = 'PENDING_COLLECTION'
  `;
  return rows[0];
}

export function toCollectionSummary(row: CollectionSummaryRow | undefined): CollectionSummary {
  const amount = row?.amount === null || row?.amount === undefined ? ZERO_MONEY() : money(row.amount);

  return {
    orderCount: Number(row?.orderCount ?? 0),
    amount: roundMoney(amount).toFixed(MONEY_DECIMAL_PLACES),
    // Null when nothing is outstanding — there is no "owed since" date for a
    // balance of zero.
    oldestCreatedAt: row?.oldestCreatedAt ? row.oldestCreatedAt.toISOString() : null,
  };
}
