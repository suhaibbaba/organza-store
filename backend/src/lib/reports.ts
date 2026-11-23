import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { MARGIN_DECIMAL_PLACES, MONEY_DECIMAL_PLACES, ORDER_CHANNELS } from "@/constants";
import type {
  ChannelAggregateRow,
  ChannelSales,
  DailySales,
  DailySalesRow,
  GiftAggregateRow,
  OrderChannel,
  ProfitTotals,
  ReportRange,
  ReturnsTotals,
  SalesAggregateRow,
  SalesTotals,
  TopSeller,
  TopSellerRow,
} from "@/types";

// Sales & profit, computed by Postgres over order item snapshots: cancelled/deleted out, returns off revenue and cost.

// The per-line view every aggregate reads (net of returns); exported so outstanding money is computed like revenue.
export function lineView(range: ReportRange | null): Prisma.Sql {
  const window = range ? Prisma.sql`AND o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to}` : Prisma.empty;

  // collected_share: 1 when paid, 0 with the courier, and for a credit sale its paid part of what it is worth now.
  return Prisma.sql`
    SELECT base.*,
      CASE base.payment_status
        WHEN 'COLLECTED' THEN 1::numeric
        WHEN 'PENDING_COLLECTION' THEN 0::numeric
        ELSE CASE WHEN base.order_net <= 0 THEN 1::numeric ELSE LEAST(base.paid_amount / base.order_net, 1) END
      END AS collected_share
    FROM (
    SELECT
      o.id            AS order_id,
      o.channel::text AS channel,
      o."onCredit"    AS on_credit,
      o."paidAmount"  AS paid_amount,
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
      oi."exchangedQuantity"::numeric                AS exchanged_units,
      (o."exchangeOfOrderId" IS NOT NULL)            AS is_exchange,
      oi."unitPrice"                                 AS unit_gross_price,
      -- What this unit really earned: its line total (item discount already
      -- applied) divided by the units on the line, times this order's
      -- discount ratio. subtotal = 0 can only happen when everything was
      -- given away, and then there is nothing to apportion.
      (oi."lineTotal" / oi.quantity)
        * (CASE WHEN o.subtotal = 0 THEN 1 ELSE o.total / o.subtotal END) AS unit_net_price,
      COALESCE(oi."unitCost", 0)  AS unit_cost,
      (oi."unitCost" IS NULL)     AS cost_missing,
      SUM((oi."lineTotal" / oi.quantity) * (oi.quantity - oi."returnedQuantity")
        * (CASE WHEN o.subtotal = 0 THEN 1 ELSE o.total / o.subtotal END)) OVER (PARTITION BY o.id) AS order_net
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."deletedAt" IS NULL
      AND o.status <> 'CANCELLED'::"OrderStatus"
      -- Gifts earn nothing; they are a cost, counted by queryGiftCost below.
      AND o.type = 'SALE'::"OrderType"
      ${window}
    ) base
  `;
}

// The same reduction for GIFTS, cost side only.
function giftLineView(range: ReportRange | null): Prisma.Sql {
  const window = range ? Prisma.sql`AND o."createdAt" >= ${range.from} AND o."createdAt" < ${range.to}` : Prisma.empty;

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

// `orderCount` counts orders with something still sold, so a fully returned order adds nothing.
const TOTALS_COLUMNS = Prisma.sql`
  COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0)            AS "orderCount",
  COALESCE(SUM(net_units), 0)                                      AS "itemCount",
  COALESCE(SUM(unit_net_price * net_units), 0)                     AS "revenue",
  -- Sold = received + with the courier + owed by customers on credit, always.
  COALESCE(SUM(unit_net_price * net_units * collected_share), 0)   AS "collectedRevenue",
  COALESCE(SUM(unit_net_price * net_units)
    FILTER (WHERE payment_status = 'PENDING_COLLECTION'), 0)       AS "pendingCollectionAmount",
  COUNT(DISTINCT order_id) FILTER (
    WHERE payment_status = 'PENDING_COLLECTION' AND net_units > 0) AS "pendingCollectionOrderCount",
  COALESCE(SUM(unit_net_price * net_units * (1 - collected_share))
    FILTER (WHERE payment_status = 'ON_CREDIT'), 0)                AS "customerDebtAmount",
  COUNT(DISTINCT order_id) FILTER (
    WHERE payment_status = 'ON_CREDIT' AND net_units > 0)          AS "customerDebtOrderCount",
  COALESCE(SUM(unit_gross_price * net_units), 0)                   AS "grossRevenue",
  COALESCE(SUM(unit_cost * net_units), 0)                          AS "cost",
  -- COGS on the part that has actually been paid for, so a "received only"
  -- profit is a real subtraction rather than an estimate.
  COALESCE(SUM(unit_cost * net_units * collected_share), 0)        AS "collectedCost",
  COUNT(*) FILTER (WHERE cost_missing AND net_units > 0)           AS "missingCostItems",
  COUNT(DISTINCT order_id) FILTER (WHERE returned_units > 0)       AS "returnedOrderCount",
  COALESCE(SUM(returned_units), 0)                                 AS "returnedItemCount",
  COALESCE(SUM(unit_net_price * returned_units), 0)                AS "returnedAmount"
`;

// --- query runners -----------------------------------------------------

export async function queryTotals(range: ReportRange): Promise<SalesAggregateRow> {
  const rows = await prisma.$queryRaw<SalesAggregateRow[]>`
    WITH line AS (${lineView(range)})
    SELECT ${TOTALS_COLUMNS} FROM line
  `;
  return rows[0];
}

// What was given away in the range at cost; zeros, never nothing.
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

// Best sellers per variant (or product), named from the newest snapshot so a rename does not split rows.
export async function queryTopSellers(
  range: ReportRange,
  by: "revenue" | "quantity",
  limit: number,
  offset = 0,
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
    ORDER BY ${orderBy}, "quantity" DESC, product_id, variant_id
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// How many rows queryTopSellers can page through, for the Sales log's pagination.
export async function countSoldItems(range: ReportRange): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    WITH line AS (${lineView(range)})
    SELECT COUNT(*) AS "count" FROM (
      SELECT 1 FROM line GROUP BY product_id, variant_id HAVING SUM(net_units) > 0
    ) sold
  `;
  return Number(rows[0]?.count ?? 0);
}

// Revenue per viewer-local day, grouped on the shifted clock so a 23:30 sale stays on its own day.
export async function queryDailySales(range: ReportRange, tzOffset: number): Promise<DailySalesRow[]> {
  return prisma.$queryRaw<DailySalesRow[]>`
    WITH line AS (${lineView(range)})
    SELECT
      to_char(created_at + make_interval(mins => ${tzOffset}::int), 'YYYY-MM-DD') AS "date",
      COUNT(DISTINCT order_id) FILTER (WHERE net_units > 0)                      AS "orderCount",
      COALESCE(SUM(unit_net_price * net_units), 0)                               AS "revenue"
    FROM line
    GROUP BY 1
  `;
}

// --- serialization -----------------------------------------------------

function decimal(value: Prisma.Decimal | null): Prisma.Decimal {
  return value === null || value === undefined ? ZERO_MONEY() : money(value);
}

function amount(value: Prisma.Decimal | null): string {
  return roundMoney(decimal(value)).toFixed(MONEY_DECIMAL_PLACES);
}

// profit / revenue as a percentage; null with no sales, since 0% would read as a loss.
function marginOf(revenue: Prisma.Decimal, profit: Prisma.Decimal): string | null {
  if (revenue.isZero()) {
    return null;
  }
  return profit
    .div(revenue)
    .mul(100)
    .toDecimalPlaces(MARGIN_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(MARGIN_DECIMAL_PLACES);
}

// `canViewCost` gates cost/profit/margin (rule 19): left out of the response, not zeroed.
export function toSalesTotals(row: SalesAggregateRow | undefined, canViewCost: boolean): SalesTotals {
  const orderCount = Number(row?.orderCount ?? 0);
  const revenue = roundMoney(decimal(row?.revenue ?? null));
  const grossRevenue = roundMoney(decimal(row?.grossRevenue ?? null));

  const totals: SalesTotals = {
    orderCount,
    itemCount: Number(decimal(row?.itemCount ?? null)),
    revenue: revenue.toFixed(MONEY_DECIMAL_PLACES),
    // Sold versus paid for: sales figures, not costs, so they need no product.viewCost.
    collectedRevenue: amount(row?.collectedRevenue ?? null),
    pendingCollectionAmount: amount(row?.pendingCollectionAmount ?? null),
    pendingCollectionOrderCount: Number(row?.pendingCollectionOrderCount ?? 0),
    customerDebtAmount: amount(row?.customerDebtAmount ?? null),
    customerDebtOrderCount: Number(row?.customerDebtOrderCount ?? 0),
    discountAmount: roundMoney(grossRevenue.sub(revenue)).toFixed(MONEY_DECIMAL_PLACES),
    averageOrderValue: (orderCount === 0 ? ZERO_MONEY() : roundMoney(revenue.div(orderCount))).toFixed(
      MONEY_DECIMAL_PLACES,
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

// Sold/received/owed; gross = sales − COGS, net = gross − approved expenses − gifts at cost.
export function toProfitTotals(
  row: SalesAggregateRow | undefined,
  gifts: GiftAggregateRow | undefined,
  expenses: Prisma.Decimal,
): ProfitTotals {
  const sold = roundMoney(decimal(row?.revenue ?? null));
  const received = roundMoney(decimal(row?.collectedRevenue ?? null));
  const cogs = roundMoney(decimal(row?.cost ?? null));
  const receivedCogs = roundMoney(decimal(row?.collectedCost ?? null));
  const giftCost = roundMoney(decimal(gifts?.cost ?? null));
  const spent = roundMoney(expenses);

  const grossProfit = roundMoney(sold.sub(cogs));
  const receivedGrossProfit = roundMoney(received.sub(receivedCogs));
  // Everything paid out (till or transfer) plus the cost of what was given away.
  const overheads = roundMoney(spent.add(giftCost));
  const netProfit = roundMoney(grossProfit.sub(overheads));

  return {
    sold: sold.toFixed(MONEY_DECIMAL_PLACES),
    received: received.toFixed(MONEY_DECIMAL_PLACES),
    // Stated, not left as a subtraction: what the delivery company still holds is what the shop chases.
    owed: amount(row?.pendingCollectionAmount ?? null),
    owedOrderCount: Number(row?.pendingCollectionOrderCount ?? 0),
    customerDebt: amount(row?.customerDebtAmount ?? null),
    customerDebtOrderCount: Number(row?.customerDebtOrderCount ?? 0),

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

// Every channel is listed, even with zero sales — a missing row reads as a bug.
export function toChannelSales(rows: ChannelAggregateRow[], canViewCost: boolean): ChannelSales[] {
  const byChannel = new Map(rows.map((row) => [row.channel, row]));
  return ORDER_CHANNELS.map((channel) => ({
    channel: channel as OrderChannel,
    ...toSalesTotals(byChannel.get(channel), canViewCost),
  }));
}

// A variant's own first photo, else its product's (as on order lines); one query for every ranked line.
export async function queryTopSellerThumbnails(rows: TopSellerRow[]): Promise<Map<string, string>> {
  const productIds = [...new Set(rows.flatMap((row) => (row.productId ? [row.productId] : [])))];
  const variantIds = [...new Set(rows.flatMap((row) => (row.variantId ? [row.variantId] : [])))];
  if (productIds.length === 0 && variantIds.length === 0) {
    return new Map();
  }
  const images = await prisma.productImage.findMany({
    where: { OR: [{ variantId: { in: variantIds } }, { productId: { in: productIds }, variantId: null }] },
    orderBy: { sortOrder: "asc" },
    select: { productId: true, variantId: true, thumbnailUrl: true },
  });
  const thumbnails = new Map<string, string>();
  for (const image of images) {
    const key = image.variantId ?? image.productId;
    if (key && !thumbnails.has(key)) {
      thumbnails.set(key, image.thumbnailUrl);
    }
  }
  return thumbnails;
}

export function toTopSellers(rows: TopSellerRow[], canViewCost: boolean, thumbnails: Map<string, string>): TopSeller[] {
  return rows.map((row) => {
    const revenue = roundMoney(decimal(row.revenue));
    const seller: TopSeller = {
      productId: row.productId,
      variantId: row.variantId,
      name: (row.name ?? {}) as TopSeller["name"],
      variantName: (row.variantName ?? null) as TopSeller["variantName"],
      sku: row.sku,
      thumbnailUrl:
        (row.variantId ? thumbnails.get(row.variantId) : undefined) ??
        (row.productId ? thumbnails.get(row.productId) : undefined) ??
        null,
      quantity: Number(decimal(row.quantity)),
      revenue: revenue.toFixed(MONEY_DECIMAL_PLACES),
    };
    if (canViewCost) {
      seller.profit = roundMoney(revenue.sub(decimal(row.cost))).toFixed(MONEY_DECIMAL_PLACES);
    }
    return seller;
  });
}

// Every date in the window gets a bar, a day without sales included.
export function toDailySales(rows: DailySalesRow[], dates: string[]): DailySales {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return {
    days: dates.map((date) => {
      const row = byDate.get(date);
      return { date, revenue: amount(row?.revenue ?? null), orderCount: Number(row?.orderCount ?? 0) };
    }),
  };
}
