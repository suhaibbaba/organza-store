import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { MARGIN_DECIMAL_PLACES, MONEY_DECIMAL_PLACES, ORDER_CHANNELS } from "@/constants";
import type {
  ChannelAggregateRow,
  ChannelSales,
  GiftAggregateRow,
  OrderChannel,
  ProfitTotals,
  ReportGranularity,
  ReportRange,
  ReturnsTotals,
  SalesAggregateRow,
  SalesSeriesPoint,
  SalesTotals,
  SeriesAggregateRow,
  TopSeller,
  TopSellerRow,
} from "@/types";

// ============================================================================
//  Sales & profit aggregation
//
//  Every figure is computed by Postgres over the ORDER ITEM SNAPSHOTS
//  (unitPrice/unitCost frozen at sale time, spec.md "Price & cost snapshots")
//  — never from today's catalogue, and never by pulling orders into memory.
//
//  The rules, in one place, because every query below shares them:
//    * cancelled and soft-deleted orders are out entirely;
//    * returned quantities come off both revenue and cost, so a fully
//      returned order nets to zero without being special-cased;
//    * an order-level discount is spread across that order's lines in
//      proportion to their totals (total / subtotal), so per-product revenue
//      adds up to the order's real revenue.
//
//  Selling and being paid are two different facts (spec.md "Payment
//  collection"), so revenue is split here into what has been COLLECTED and
//  what the delivery company still owes — never conflated into one figure.
//
//  GIFTS ARE NOT SALES. An order of type GIFT is excluded from everything
//  below: it earned nothing, so counting it would drag the average order
//  value, the margin and the channel split towards zero for no reason. What
//  it COST the shop is aggregated separately (queryGiftCost) and subtracted
//  as a cost of doing business — see spec.md "Cash drawer & expenses".
// ============================================================================

// The per-line view every aggregate selects from: one row per sold line,
// already reduced to per-unit money and net (un-returned) quantities.
//
// Exported because the outstanding-money summary (lib/orderCollection.ts) has
// to compute its total exactly the way revenue is computed here — otherwise
// the orders screen and the reports screen could quote different amounts for
// the same sales. A null range means "every sale ever", which is what an
// outstanding balance is.
export function lineView(range: ReportRange | null): Prisma.Sql {
  const window = range
    ? Prisma.sql`AND o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT
      o.id            AS order_id,
      o.channel::text AS channel,
      o."paymentStatus"::text AS payment_status,
      o."paymentMethod"::text AS payment_method,
      o."createdAt"   AS created_at,
      -- When the money actually reached the shop. The cash drawer windows on
      -- this rather than on created_at: a courier order rung up in July but
      -- settled in August is August's cash.
      o."collectedAt" AS collected_at,
      oi."productId"  AS product_id,
      oi."variantId"  AS variant_id,
      oi.name         AS name,
      oi."variantName" AS variant_name,
      oi.sku          AS sku,
      (oi.quantity - oi."returnedQuantity")::numeric AS net_units,
      oi."returnedQuantity"::numeric                 AS returned_units,
      oi."unitPrice"                                 AS unit_gross_price,
      -- What this unit really earned: its line total (item discount already
      -- applied) divided by the units on the line, times this order's
      -- discount ratio. subtotal = 0 can only happen when everything was
      -- given away, and then there is nothing to apportion.
      (oi."lineTotal" / oi.quantity)
        * (CASE WHEN o.subtotal = 0 THEN 1 ELSE o.total / o.subtotal END) AS unit_net_price,
      COALESCE(oi."unitCost", 0)  AS unit_cost,
      (oi."unitCost" IS NULL)     AS cost_missing
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."deletedAt" IS NULL
      AND o.status <> 'CANCELLED'::"OrderStatus"
      -- Gifts earn nothing; they are a cost, counted by queryGiftCost below.
      AND o.type = 'SALE'::"OrderType"
      ${window}
  `;
}

// The same per-line reduction for GIFTS — the orders the view above
// deliberately drops. Only the cost side exists here: there is no revenue to
// compute, and the retail price of something given away is not money the
// shop ever had.
function giftLineView(range: ReportRange | null): Prisma.Sql {
  const window = range
    ? Prisma.sql`AND o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to}`
    : Prisma.empty;

  return Prisma.sql`
    SELECT
      o.id AS order_id,
      (oi.quantity - oi."returnedQuantity")::numeric AS net_units,
      COALESCE(oi."unitCost", 0)                     AS unit_cost
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."deletedAt" IS NULL
      AND o.status <> 'CANCELLED'::"OrderStatus"
      AND o.type = 'GIFT'::"OrderType"
      ${window}
  `;
}

// The columns every totals query returns. `orderCount` counts orders that
// still have something sold in them, so a fully returned order neither adds
// revenue nor inflates the average order value.
const TOTALS_COLUMNS = Prisma.sql`
  COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0)            AS "orderCount",
  COALESCE(SUM(net_units), 0)                                      AS "itemCount",
  COALESCE(SUM(unit_net_price * net_units), 0)                     AS "revenue",
  -- Sold vs. actually paid for. The two filters partition the same revenue,
  -- so collected + pending always adds back up to it.
  COALESCE(SUM(unit_net_price * net_units)
    FILTER (WHERE payment_status = 'COLLECTED'), 0)                AS "collectedRevenue",
  COALESCE(SUM(unit_net_price * net_units)
    FILTER (WHERE payment_status = 'PENDING_COLLECTION'), 0)       AS "pendingCollectionAmount",
  COUNT(DISTINCT order_id) FILTER (
    WHERE payment_status = 'PENDING_COLLECTION' AND net_units > 0) AS "pendingCollectionOrderCount",
  COALESCE(SUM(unit_gross_price * net_units), 0)                   AS "grossRevenue",
  COALESCE(SUM(unit_cost * net_units), 0)                          AS "cost",
  -- COGS on the part that has actually been paid for, so a "received only"
  -- profit is a real subtraction rather than an estimate.
  COALESCE(SUM(unit_cost * net_units)
    FILTER (WHERE payment_status = 'COLLECTED'), 0)                AS "collectedCost",
  COUNT(*) FILTER (WHERE cost_missing AND net_units > 0)           AS "missingCostItems",
  COUNT(DISTINCT order_id) FILTER (WHERE returned_units > 0)       AS "returnedOrderCount",
  COALESCE(SUM(returned_units), 0)                                 AS "returnedItemCount",
  COALESCE(SUM(unit_net_price * returned_units), 0)                AS "returnedAmount"
`;

// Postgres date_trunc unit for the chart buckets. Fixed strings from a
// closed set — never caller input — so they can be inlined safely.
// Note date_trunc('week') cuts on Monday (ISO); that only labels the bars of
// a long range, and is independent of REPORT_WEEK_START_DAY, which decides
// where the dashboard's "this week" figure starts.
const TRUNC_UNIT: Record<ReportGranularity, string> = {
  day: "day",
  week: "week",
  month: "month",
};

// --- query runners -----------------------------------------------------

export async function queryTotals(range: ReportRange): Promise<SalesAggregateRow> {
  const rows = await prisma.$queryRaw<SalesAggregateRow[]>`
    WITH line AS (${lineView(range)})
    SELECT ${TOTALS_COLUMNS} FROM line
  `;
  return rows[0];
}

// What the shop gave away in this range, at what it paid for it. Returns
// zeros rather than nothing when no gifts were given, so the caller never has
// to special-case an empty range.
export async function queryGiftCost(range: ReportRange): Promise<GiftAggregateRow> {
  const rows = await prisma.$queryRaw<GiftAggregateRow[]>`
    WITH line AS (${giftLineView(range)})
    SELECT
      COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0) AS "orderCount",
      COALESCE(SUM(net_units), 0)                           AS "itemCount",
      COALESCE(SUM(unit_cost * net_units), 0)               AS "cost"
    FROM line
  `;
  return rows[0];
}

export async function queryChannelTotals(range: ReportRange): Promise<ChannelAggregateRow[]> {
  return prisma.$queryRaw<ChannelAggregateRow[]>`
    WITH line AS (${lineView(range)})
    SELECT channel AS "channel", ${TOTALS_COLUMNS}
    FROM line
    GROUP BY channel
  `;
}

// Revenue (and cost) per chart bucket. The bucket is cut on the VIEWER's
// clock — createdAt is shifted by their offset before truncation — so a late
// evening sale lands on the day they made it.
export async function querySeries(
  range: ReportRange,
  granularity: ReportGranularity,
  tzOffset: number
): Promise<SeriesAggregateRow[]> {
  const unit = Prisma.raw(`'${TRUNC_UNIT[granularity]}'`);
  return prisma.$queryRaw<SeriesAggregateRow[]>`
    WITH line AS (${lineView(range)})
    SELECT
      to_char(date_trunc(${unit}, created_at + make_interval(mins => ${tzOffset}::int)), 'YYYY-MM-DD') AS "bucket",
      COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0) AS "orderCount",
      COALESCE(SUM(unit_net_price * net_units), 0)          AS "revenue",
      COALESCE(SUM(unit_cost * net_units), 0)               AS "cost"
    FROM line
    GROUP BY 1
    ORDER BY 1
  `;
}

// Best sellers, one row per sold thing: the variant when the product has
// them, the product itself otherwise. Names come from the newest snapshot of
// that line, so a product renamed between sales shows its current name
// instead of splitting into two rows.
export async function queryTopSellers(
  range: ReportRange,
  by: "revenue" | "quantity",
  limit: number
): Promise<TopSellerRow[]> {
  const orderBy = by === "revenue" ? Prisma.sql`"revenue" DESC` : Prisma.sql`"quantity" DESC`;
  return prisma.$queryRaw<TopSellerRow[]>`
    WITH line AS (${lineView(range)})
    SELECT
      product_id AS "productId",
      variant_id AS "variantId",
      (ARRAY_AGG(name ORDER BY created_at DESC))[1]         AS "name",
      (ARRAY_AGG(variant_name ORDER BY created_at DESC))[1] AS "variantName",
      (ARRAY_AGG(sku ORDER BY created_at DESC))[1]          AS "sku",
      SUM(net_units)                                        AS "quantity",
      SUM(unit_net_price * net_units)                       AS "revenue",
      SUM(unit_cost * net_units)                            AS "cost"
    FROM line
    GROUP BY product_id, variant_id
    HAVING SUM(net_units) > 0
    ORDER BY ${orderBy}, "quantity" DESC
    LIMIT ${limit}
  `;
}

// --- serialization -----------------------------------------------------

function decimal(value: Prisma.Decimal | null): Prisma.Decimal {
  return value === null || value === undefined ? ZERO_MONEY() : money(value);
}

function amount(value: Prisma.Decimal | null): string {
  return roundMoney(decimal(value)).toFixed(MONEY_DECIMAL_PLACES);
}

// profit / revenue, as a percentage. Null rather than 0 when nothing was
// sold: there is no margin on no sales, and a 0% would read as a loss.
function marginOf(revenue: Prisma.Decimal, profit: Prisma.Decimal): string | null {
  if (revenue.isZero()) return null;
  return profit.div(revenue).mul(100).toDecimalPlaces(MARGIN_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP).toFixed(MARGIN_DECIMAL_PLACES);
}

// Turns one aggregate row into the DTO. `canViewCost` is the real gate for
// cost/profit/margin (CLAUDE.md rule 19): the fields are left OUT of the
// response for anyone without it, not zeroed — an Employee's report simply
// has no cost in it to leak.
export function toSalesTotals(row: SalesAggregateRow | undefined, canViewCost: boolean): SalesTotals {
  const orderCount = Number(row?.orderCount ?? 0);
  const revenue = roundMoney(decimal(row?.revenue ?? null));
  const grossRevenue = roundMoney(decimal(row?.grossRevenue ?? null));

  const totals: SalesTotals = {
    orderCount,
    itemCount: Number(decimal(row?.itemCount ?? null)),
    revenue: revenue.toFixed(MONEY_DECIMAL_PLACES),
    // What was sold vs. what has actually been paid for. Visible to every
    // role that may read a report: these are sales figures, not costs, and an
    // Employee already sees order totals in the list.
    collectedRevenue: amount(row?.collectedRevenue ?? null),
    pendingCollectionAmount: amount(row?.pendingCollectionAmount ?? null),
    pendingCollectionOrderCount: Number(row?.pendingCollectionOrderCount ?? 0),
    discountAmount: roundMoney(grossRevenue.sub(revenue)).toFixed(MONEY_DECIMAL_PLACES),
    averageOrderValue: (orderCount === 0 ? ZERO_MONEY() : roundMoney(revenue.div(orderCount))).toFixed(
      MONEY_DECIMAL_PLACES
    ),
  };

  if (canViewCost) {
    const cost = roundMoney(decimal(row?.cost ?? null));
    const profit = roundMoney(revenue.sub(cost));
    totals.cost = cost.toFixed(MONEY_DECIMAL_PLACES);
    totals.profit = profit.toFixed(MONEY_DECIMAL_PLACES);
    totals.margin = marginOf(revenue, profit);
    totals.missingCostItems = Number(row?.missingCostItems ?? 0);
  }

  return totals;
}

// The money question stated without a single ambiguous number (spec.md
// "Cash drawer & expenses" -> Reporting).
//
// Three states of the same sales — sold / received / owed, which always add
// back up — and two profits, each given for all sales AND for the received
// part alone:
//
//   gross = sales - COGS
//   net   = gross - approved expenses - gifts at cost
//
// Expenses are subtracted in full from the received-only net too: a bill is
// owed whether or not the delivery company has settled up yet.
//
// ADMIN ONLY. The caller (routes/reports.ts) is what decides whether this is
// computed at all — below that permission the block is simply absent from the
// response, so there is nothing to un-hide client-side.
export function toProfitTotals(
  row: SalesAggregateRow | undefined,
  gifts: GiftAggregateRow | undefined,
  expenses: Prisma.Decimal
): ProfitTotals {
  const sold = roundMoney(decimal(row?.revenue ?? null));
  const received = roundMoney(decimal(row?.collectedRevenue ?? null));
  const cogs = roundMoney(decimal(row?.cost ?? null));
  const receivedCogs = roundMoney(decimal(row?.collectedCost ?? null));
  const giftCost = roundMoney(decimal(gifts?.cost ?? null));
  const spent = roundMoney(expenses);

  const grossProfit = roundMoney(sold.sub(cogs));
  const receivedGrossProfit = roundMoney(received.sub(receivedCogs));
  // Everything the shop paid out, whether the money came from the till or a
  // transfer, plus what the stock it gave away had cost it.
  const overheads = roundMoney(spent.add(giftCost));
  const netProfit = roundMoney(grossProfit.sub(overheads));

  return {
    sold: sold.toFixed(MONEY_DECIMAL_PLACES),
    received: received.toFixed(MONEY_DECIMAL_PLACES),
    // Stated rather than left as a subtraction, because "what is still with
    // the delivery company" is the figure the shop chases.
    owed: amount(row?.pendingCollectionAmount ?? null),
    owedOrderCount: Number(row?.pendingCollectionOrderCount ?? 0),

    cogs: cogs.toFixed(MONEY_DECIMAL_PLACES),
    receivedCogs: receivedCogs.toFixed(MONEY_DECIMAL_PLACES),
    expenses: spent.toFixed(MONEY_DECIMAL_PLACES),
    giftCost: giftCost.toFixed(MONEY_DECIMAL_PLACES),
    overheads: overheads.toFixed(MONEY_DECIMAL_PLACES),

    grossProfit: grossProfit.toFixed(MONEY_DECIMAL_PLACES),
    netProfit: netProfit.toFixed(MONEY_DECIMAL_PLACES),
    receivedGrossProfit: receivedGrossProfit.toFixed(MONEY_DECIMAL_PLACES),
    receivedNetProfit: roundMoney(receivedGrossProfit.sub(overheads)).toFixed(MONEY_DECIMAL_PLACES),

    // What the shop keeps out of what it sold, after everything.
    netMargin: marginOf(sold, netProfit),

    missingCostItems: Number(row?.missingCostItems ?? 0),
  };
}

export function toReturnsTotals(row: SalesAggregateRow | undefined): ReturnsTotals {
  return {
    orderCount: Number(row?.returnedOrderCount ?? 0),
    itemCount: Number(decimal(row?.returnedItemCount ?? null)),
    amount: amount(row?.returnedAmount ?? null),
  };
}

// Every channel is listed, including the ones that sold nothing in the range
// — a breakdown with a missing row reads as a bug to a non-technical user,
// while an explicit zero reads as "none through here".
export function toChannelSales(rows: ChannelAggregateRow[], canViewCost: boolean): ChannelSales[] {
  const byChannel = new Map(rows.map((row) => [row.channel, row]));
  return ORDER_CHANNELS.map((channel) => ({
    channel: channel as OrderChannel,
    ...toSalesTotals(byChannel.get(channel), canViewCost),
  }));
}

export function toSeries(rows: SeriesAggregateRow[], canViewCost: boolean): SalesSeriesPoint[] {
  return rows.map((row) => {
    const revenue = roundMoney(decimal(row.revenue));
    const point: SalesSeriesPoint = {
      date: row.bucket,
      orderCount: Number(row.orderCount),
      revenue: revenue.toFixed(MONEY_DECIMAL_PLACES),
    };
    if (canViewCost) {
      point.profit = roundMoney(revenue.sub(decimal(row.cost))).toFixed(MONEY_DECIMAL_PLACES);
    }
    return point;
  });
}

export function toTopSellers(rows: TopSellerRow[], canViewCost: boolean): TopSeller[] {
  return rows.map((row) => {
    const revenue = roundMoney(decimal(row.revenue));
    const seller: TopSeller = {
      productId: row.productId,
      variantId: row.variantId,
      name: (row.name ?? {}) as TopSeller["name"],
      variantName: (row.variantName ?? null) as TopSeller["variantName"],
      sku: row.sku,
      quantity: Number(decimal(row.quantity)),
      revenue: revenue.toFixed(MONEY_DECIMAL_PLACES),
    };
    if (canViewCost) {
      seller.profit = roundMoney(revenue.sub(decimal(row.cost))).toFixed(MONEY_DECIMAL_PLACES);
    }
    return seller;
  });
}
