import { Prisma, type Customer as CustomerRow } from "@prisma/client";
import { dualPrefixCandidates, nationalPhoneDigits } from "@store/shared/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatMoney, money, roundMoney, zeroMoneyText, ZERO_MONEY, type Money } from "@/lib/money";
import { orderBalance, recordOrderPayment, type PaymentRecorded } from "@/lib/orderCredit";
import { AppError } from "@/lib/response";
import { ERROR_CODES, MAIN_IMAGE_ONLY, MAX_ORDERS_PER_CUSTOMER_PAYMENT, MONEY_DECIMAL_PLACES } from "@/constants";
import type {
  CustomerDetail,
  CustomerListMeta,
  CustomerPaymentAllocation,
  CustomerSummary,
  ListCustomersQuery,
} from "@/types";

// Customers and their balances (spec.md "Customers and selling on credit"); one SQL definition of "owed" for every screen.

// Phone uniqueness under both Palestine prefixes (rule 18): +970 and +972 with the same digits are one customer.
export function findCustomerByPhone(
  client: Prisma.TransactionClient | typeof prisma,
  phone: string,
  exceptId?: string,
): Promise<CustomerRow | null> {
  return client.customer.findFirst({
    where: { phone: { in: dualPrefixCandidates(phone) }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
}

export async function assertPhoneFree(
  client: Prisma.TransactionClient | typeof prisma,
  phone: string,
  exceptId?: string,
) {
  if (await findCustomerByPhone(client, phone, exceptId)) {
    throw new AppError(409, ERROR_CODES.CUSTOMER_PHONE_TAKEN);
  }
}

// A WhatsApp order finds its customer by phone, or creates one from the order's details.
export async function ensureCustomerForOrder(
  tx: Prisma.TransactionClient,
  details: {
    name: string;
    phone: string;
    whatsapp?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  userId: string,
): Promise<CustomerRow> {
  const existing = await findCustomerByPhone(tx, details.phone);
  if (existing) {
    return existing;
  }
  return tx.customer.create({
    data: {
      name: details.name,
      phone: details.phone,
      whatsapp: details.whatsapp ?? null,
      address: details.address ?? null,
      latitude: details.latitude ?? null,
      longitude: details.longitude ?? null,
      createdById: userId,
    },
  });
}

// Per-customer balance, open orders, kept pieces and activity: the one definition the list, page and dashboard share.
const STATS_CTE = Prisma.sql`
  open_credit AS (
    SELECT o."customerId" AS customer_id, o.id,
      GREATEST(
        ROUND(SUM((oi."lineTotal" / oi.quantity) * (oi.quantity - oi."returnedQuantity"))
          * (CASE WHEN o.subtotal = 0 THEN 1 ELSE o.total / o.subtotal END), 2) - o."paidAmount",
        0) AS owed
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    WHERE o."customerId" IS NOT NULL
      AND o."onCredit"
      AND o."paymentStatus" = 'ON_CREDIT'::"PaymentStatus"
      AND o."deletedAt" IS NULL
      AND o.status <> 'CANCELLED'::"OrderStatus"
    GROUP BY o.id
  ),
  debt AS (
    SELECT customer_id, SUM(owed) AS balance, COUNT(*) FILTER (WHERE owed > 0) AS open_count
    FROM open_credit GROUP BY customer_id
  ),
  kept AS (
    SELECT o."customerId" AS customer_id, SUM(oi.quantity - oi."returnedQuantity") AS pieces
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."customerId" IS NOT NULL
      AND o."onCredit"
      AND oi."handedOverAt" IS NULL
      AND oi.quantity > oi."returnedQuantity"
      AND o."deletedAt" IS NULL
      AND o.status NOT IN ('CANCELLED'::"OrderStatus", 'RETURNED'::"OrderStatus")
    GROUP BY o."customerId"
  ),
  activity AS (
    SELECT "customerId" AS customer_id, COUNT(*) AS order_count, MAX("createdAt") AS last_order_at
    FROM "Order"
    WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "customerId"
  ),
  stats AS (
    SELECT c.*,
      COALESCE(debt.balance, 0)    AS balance,
      COALESCE(debt.open_count, 0) AS open_order_count,
      COALESCE(kept.pieces, 0)     AS kept_piece_count,
      COALESCE(activity.order_count, 0) AS order_count,
      activity.last_order_at
    FROM "Customer" c
    LEFT JOIN debt ON debt.customer_id = c.id
    LEFT JOIN kept ON kept.customer_id = c.id
    LEFT JOIN activity ON activity.customer_id = c.id
  )
`;

interface StatsRow extends CustomerRow {
  balance: Prisma.Decimal;
  open_order_count: bigint;
  kept_piece_count: Prisma.Decimal | bigint;
  order_count: bigint;
  last_order_at: Date | null;
}

function serializeCustomerRow(row: CustomerRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeCustomer(row: CustomerRow) {
  return serializeCustomerRow(row);
}

function toSummary(row: StatsRow): CustomerSummary {
  return {
    ...serializeCustomerRow(row),
    balance: formatMoney(row.balance.toString()) ?? zeroMoneyText(),
    openOrderCount: Number(row.open_order_count),
    keptPieceCount: Number(row.kept_piece_count),
    orderCount: Number(row.order_count),
    lastOrderAt: row.last_order_at ? row.last_order_at.toISOString() : null,
  };
}

const SORT_COLUMNS: Record<ListCustomersQuery["sortBy"], Prisma.Sql> = {
  name: Prisma.sql`name`,
  balance: Prisma.sql`balance`,
  createdAt: Prisma.sql`"createdAt"`,
  lastOrderAt: Prisma.sql`last_order_at`,
};

function listWhere(query: ListCustomersQuery): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (query.q) {
    const digits = nationalPhoneDigits(query.q).replace(/^0+/, "");
    const byName = Prisma.sql`name ILIKE ${`%${query.q}%`}`;
    clauses.push(
      digits.length >= 3
        ? Prisma.sql`(${byName} OR regexp_replace(phone, '\\D', '', 'g') LIKE ${`%${digits}%`})`
        : byName,
    );
  }
  if (query.owing) {
    clauses.push(Prisma.sql`balance > 0`);
  }
  if (query.keptPieces) {
    clauses.push(Prisma.sql`kept_piece_count > 0`);
  }
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty;
}

export async function listCustomers(
  query: ListCustomersQuery,
  withTotals: boolean,
): Promise<{ rows: CustomerSummary[]; total: number; meta: CustomerListMeta }> {
  const where = listWhere(query);
  const direction = query.sortDir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const offset = (query.page - 1) * query.pageSize;

  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<StatsRow[]>`
      WITH ${STATS_CTE}
      SELECT * FROM stats ${where}
      ORDER BY ${SORT_COLUMNS[query.sortBy]} ${direction} NULLS LAST, name ASC, id ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ total: bigint; total_debt: Prisma.Decimal | null; owing: bigint }[]>`
      WITH ${STATS_CTE}
      SELECT
        (SELECT COUNT(*) FROM stats ${where}) AS total,
        (SELECT COALESCE(SUM(balance), 0) FROM stats) AS total_debt,
        (SELECT COUNT(*) FROM stats WHERE balance > 0) AS owing
    `,
  ]);

  const count = counts[0];
  // The shop-wide debt is a money total, so only for whoever may see the dashboard (rule 19).
  const meta: CustomerListMeta = withTotals
    ? {
        totalDebt: formatMoney(count?.total_debt?.toString()) ?? zeroMoneyText(),
        owingCount: Number(count?.owing ?? 0),
      }
    : {};

  return { rows: rows.map(toSummary), total: Number(count?.total ?? 0), meta };
}

export async function countCustomerActions(): Promise<{ customersOwing: number; keptPieces: number }> {
  const rows = await prisma.$queryRaw<{ owing: bigint; kept: Prisma.Decimal | bigint | null }[]>`
    WITH ${STATS_CTE}
    SELECT COUNT(*) FILTER (WHERE balance > 0) AS owing, COALESCE(SUM(kept_piece_count), 0) AS kept FROM stats
  `;
  return { customersOwing: Number(rows[0]?.owing ?? 0), keptPieces: Number(rows[0]?.kept ?? 0) };
}

const DETAIL_ORDER_LIMIT = 100;
const DETAIL_PAYMENT_LIMIT = 100;

export async function loadCustomerDetail(id: string): Promise<CustomerDetail> {
  const rows = await prisma.$queryRaw<StatsRow[]>`WITH ${STATS_CTE} SELECT * FROM stats WHERE id = ${id}`;
  const row = rows[0];
  if (!row) {
    throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND);
  }

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: DETAIL_ORDER_LIMIT,
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            product: { select: { images: MAIN_IMAGE_ONLY } },
            variant: { select: { images: MAIN_IMAGE_ONLY } },
          },
        },
      },
    }),
    prisma.orderPayment.findMany({
      where: { order: { customerId: id } },
      orderBy: { receivedAt: "desc" },
      take: DETAIL_PAYMENT_LIMIT,
      include: { order: { select: { orderNumber: true } }, receivedBy: { select: { id: true, name: true } } },
    }),
  ]);

  const keptPieces = orders
    .filter((order) => order.onCredit && order.status !== "CANCELLED" && order.status !== "RETURNED")
    .flatMap((order) =>
      order.items
        .filter((item) => item.handedOverAt === null && item.quantity > item.returnedQuantity)
        .map((item) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderItemId: item.id,
          name: item.name as CustomerDetail["keptPieces"][number]["name"],
          variantName: (item.variantName ?? null) as CustomerDetail["keptPieces"][number]["variantName"],
          quantity: item.quantity - item.returnedQuantity,
          thumbnailUrl: item.variant?.images?.[0]?.thumbnailUrl ?? item.product?.images?.[0]?.thumbnailUrl ?? null,
          soldAt: order.createdAt.toISOString(),
        })),
    );

  return {
    ...toSummary(row),
    keptPieces,
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      onCredit: order.onCredit,
      total: formatMoney(order.total.toString()) ?? zeroMoneyText(),
      paidAmount: formatMoney(order.paidAmount.toString()) ?? zeroMoneyText(),
      balance: (order.onCredit ? orderBalance(order) : ZERO_MONEY()).toFixed(MONEY_DECIMAL_PLACES),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity - item.returnedQuantity, 0),
      createdAt: order.createdAt.toISOString(),
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      amount: formatMoney(payment.amount.toString()) ?? zeroMoneyText(),
      receivedAt: payment.receivedAt.toISOString(),
      note: payment.note,
      receivedBy: payment.receivedBy,
    })),
  };
}

// One payment spread over the customer's open credit orders, oldest first; with `save` false nothing is written.
export async function payCustomerDebt(
  tx: Prisma.TransactionClient,
  customerId: string,
  input: { amount: string; note?: string; userId: string; save: boolean },
): Promise<{ allocations: CustomerPaymentAllocation[]; recorded: PaymentRecorded[]; balance: Money }> {
  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) {
    throw new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND);
  }

  const openIds = await tx.order.findMany({
    where: {
      customerId,
      onCredit: true,
      paymentStatus: "ON_CREDIT",
      deletedAt: null,
      status: { not: "CANCELLED" },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_ORDERS_PER_CUSTOMER_PAYMENT,
    select: { id: true },
  });
  if (openIds.length === 0) {
    throw new AppError(409, ERROR_CODES.CUSTOMER_NOTHING_OWED);
  }

  // Locked oldest first, the order every caller uses, so two payments at once can neither deadlock nor overpay.
  if (input.save) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id IN (${Prisma.join(openIds.map((o) => o.id))}) ORDER BY "createdAt", id FOR UPDATE`;
  }
  const orders = await tx.order.findMany({
    where: { id: { in: openIds.map((o) => o.id) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { items: { select: { lineTotal: true, quantity: true, returnedQuantity: true } } },
  });

  const owing = orders
    .map((order) => ({ order, balance: orderBalance(order) }))
    .filter((o) => o.balance.greaterThan(0));
  const totalOwed = owing.reduce((sum, o) => sum.add(o.balance), ZERO_MONEY());
  if (totalOwed.isZero()) {
    throw new AppError(409, ERROR_CODES.CUSTOMER_NOTHING_OWED);
  }

  let left = roundMoney(money(input.amount));
  if (left.greaterThan(totalOwed)) {
    throw new AppError(400, ERROR_CODES.ORDER_PAYMENT_EXCEEDS_BALANCE);
  }

  const allocations: CustomerPaymentAllocation[] = [];
  const recorded: PaymentRecorded[] = [];
  const at = new Date();

  for (const { order, balance } of owing) {
    if (left.lessThanOrEqualTo(0)) {
      break;
    }
    const share = left.greaterThan(balance) ? balance : left;
    left = roundMoney(left.sub(share));
    allocations.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: share.toFixed(MONEY_DECIMAL_PLACES),
      balanceBefore: balance.toFixed(MONEY_DECIMAL_PLACES),
      balanceAfter: roundMoney(balance.sub(share)).toFixed(MONEY_DECIMAL_PLACES),
    });
    if (input.save) {
      recorded.push(await recordOrderPayment(tx, order, { amount: share, note: input.note, userId: input.userId, at }));
    }
  }

  return { allocations, recorded, balance: roundMoney(totalOwed.sub(money(input.amount))) };
}
