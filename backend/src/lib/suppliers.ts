import { Prisma, type Supplier as SupplierRow } from "@prisma/client";
import { dualPrefixCandidates, nationalPhoneDigits } from "@store/shared/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatMoney, money, roundMoney, zeroMoneyText, ZERO_MONEY, type Money } from "@/lib/money";
import { AppError } from "@/lib/response";
import {
  ERROR_CODES,
  MAX_INVOICES_PER_SUPPLIER_PAYMENT,
  MONEY_DECIMAL_PLACES,
  SUPPLIER_DETAIL_INVOICE_LIMIT,
  SUPPLIER_DETAIL_PAYMENT_LIMIT,
} from "@/constants";
import type {
  ListSuppliersQuery,
  SupplierDetail,
  SupplierInvoiceRow,
  SupplierListMeta,
  SupplierPaymentAllocation,
  SupplierSummary,
} from "@/types";

type Client = Prisma.TransactionClient | typeof prisma;

// Suppliers and what the shop owes them (spec.md "Suppliers and their invoices"); owed = invoice total − paid, never below zero.

// Phone is optional, but when given it is unique under both Palestine prefixes (rule 18).
export async function assertSupplierPhoneFree(client: Client, phone: string, exceptId?: string) {
  const taken = await client.supplier.findFirst({
    where: { phone: { in: dualPrefixCandidates(phone) }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) {
    throw new AppError(409, ERROR_CODES.SUPPLIER_PHONE_TAKEN);
  }
}

const STATS_CTE = Prisma.sql`
  inv AS (
    SELECT "supplierId" AS supplier_id,
      COUNT(*) AS invoice_count,
      COUNT(*) FILTER (WHERE total > "paidAmount") AS open_count,
      SUM(GREATEST(total - "paidAmount", 0)) AS balance,
      MAX("invoiceDate") AS last_invoice_at
    FROM "SupplierInvoice"
    WHERE "deletedAt" IS NULL
    GROUP BY "supplierId"
  ),
  stats AS (
    SELECT s.*,
      COALESCE(inv.balance, 0)       AS balance,
      COALESCE(inv.open_count, 0)    AS open_invoice_count,
      COALESCE(inv.invoice_count, 0) AS invoice_count,
      inv.last_invoice_at            AS last_invoice_at
    FROM "Supplier" s
    LEFT JOIN inv ON inv.supplier_id = s.id
  )
`;

interface StatsRow extends SupplierRow {
  balance: Prisma.Decimal;
  open_invoice_count: bigint;
  invoice_count: bigint;
  last_invoice_at: Date | null;
}

export function serializeSupplier(row: SupplierRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    address: row.address,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSummary(row: StatsRow): SupplierSummary {
  return {
    ...serializeSupplier(row),
    balance: formatMoney(row.balance.toString()) ?? zeroMoneyText(),
    openInvoiceCount: Number(row.open_invoice_count),
    invoiceCount: Number(row.invoice_count),
    lastInvoiceAt: row.last_invoice_at ? dateOnly(row.last_invoice_at) : null,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const SORT_COLUMNS: Record<ListSuppliersQuery["sortBy"], Prisma.Sql> = {
  name: Prisma.sql`name`,
  balance: Prisma.sql`balance`,
  createdAt: Prisma.sql`"createdAt"`,
  lastInvoiceAt: Prisma.sql`last_invoice_at`,
};

function listWhere(query: ListSuppliersQuery): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (query.q) {
    const digits = nationalPhoneDigits(query.q).replace(/^0+/, "");
    const byName = Prisma.sql`name ILIKE ${`%${query.q}%`}`;
    clauses.push(
      digits.length >= 3
        ? Prisma.sql`(${byName} OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ${`%${digits}%`})`
        : byName,
    );
  }
  if (query.owing) {
    clauses.push(Prisma.sql`balance > 0`);
  }
  return clauses.length ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty;
}

export async function listSuppliers(
  query: ListSuppliersQuery,
): Promise<{ rows: SupplierSummary[]; total: number; meta: SupplierListMeta }> {
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
    prisma.$queryRaw<{ total: bigint; total_owed: Prisma.Decimal | null; owing: bigint }[]>`
      WITH ${STATS_CTE}
      SELECT
        (SELECT COUNT(*) FROM stats ${where}) AS total,
        (SELECT COALESCE(SUM(balance), 0) FROM stats) AS total_owed,
        (SELECT COUNT(*) FROM stats WHERE balance > 0) AS owing
    `,
  ]);
  const count = counts[0];
  return {
    rows: rows.map(toSummary),
    total: Number(count?.total ?? 0),
    meta: {
      totalOwed: formatMoney(count?.total_owed?.toString()) ?? zeroMoneyText(),
      owingCount: Number(count?.owing ?? 0),
    },
  };
}

function invoiceBalance(invoice: { total: Prisma.Decimal; paidAmount: Prisma.Decimal }): Money {
  const left = roundMoney(invoice.total.sub(invoice.paidAmount));
  return left.greaterThan(0) ? left : ZERO_MONEY();
}

function actor(user: { id: string; name: string } | null | undefined) {
  return user ? { id: user.id, name: user.name } : null;
}

export function serializeInvoice(invoice: {
  id: string;
  invoiceNumber: string | null;
  invoiceDate: Date;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  note: string | null;
  createdAt: Date;
  createdBy?: { id: string; name: string } | null;
  _count?: { payments: number };
}): SupplierInvoiceRow {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: dateOnly(invoice.invoiceDate),
    total: invoice.total.toFixed(MONEY_DECIMAL_PLACES),
    paidAmount: invoice.paidAmount.toFixed(MONEY_DECIMAL_PLACES),
    balance: invoiceBalance(invoice).toFixed(MONEY_DECIMAL_PLACES),
    note: invoice.note,
    paymentCount: invoice._count?.payments ?? 0,
    createdAt: invoice.createdAt.toISOString(),
    createdBy: actor(invoice.createdBy),
  };
}

export async function loadSupplierDetail(id: string): Promise<SupplierDetail> {
  const rows = await prisma.$queryRaw<StatsRow[]>`WITH ${STATS_CTE} SELECT * FROM stats WHERE id = ${id}`;
  const row = rows[0];
  if (!row) {
    throw new AppError(404, ERROR_CODES.SUPPLIER_NOT_FOUND);
  }

  const [invoices, payments, sums] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where: { supplierId: id, deletedAt: null },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      take: SUPPLIER_DETAIL_INVOICE_LIMIT,
      include: { createdBy: { select: { id: true, name: true } }, _count: { select: { payments: true } } },
    }),
    prisma.supplierPayment.findMany({
      where: { supplierId: id },
      orderBy: { paidAt: "desc" },
      take: SUPPLIER_DETAIL_PAYMENT_LIMIT,
      include: {
        invoice: { select: { invoiceNumber: true, invoiceDate: true } },
        paidBy: { select: { id: true, name: true } },
      },
    }),
    prisma.supplierInvoice.aggregate({
      where: { supplierId: id, deletedAt: null },
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  return {
    ...toSummary(row),
    totalInvoiced: (sums._sum.total ?? ZERO_MONEY()).toFixed(MONEY_DECIMAL_PLACES),
    totalPaid: (sums._sum.paidAmount ?? ZERO_MONEY()).toFixed(MONEY_DECIMAL_PLACES),
    invoices: invoices.map(serializeInvoice),
    payments: payments.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      invoiceDate: dateOnly(payment.invoice.invoiceDate),
      amount: payment.amount.toFixed(MONEY_DECIMAL_PLACES),
      fromDrawer: payment.fromDrawer,
      paidAt: payment.paidAt.toISOString(),
      note: payment.note,
      paidBy: actor(payment.paidBy),
    })),
  };
}

export interface SupplierPaymentRecorded {
  paymentId: string;
  invoiceId: string;
  amount: Money;
}

// One payment, against one invoice or spread oldest invoice first; with `save` false nothing is written.
export async function paySupplier(
  tx: Prisma.TransactionClient,
  supplierId: string,
  input: { amount: string; fromDrawer: boolean; invoiceId?: string; note?: string; userId: string; save: boolean },
): Promise<{ allocations: SupplierPaymentAllocation[]; recorded: SupplierPaymentRecorded[]; balance: Money }> {
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
  if (!supplier) {
    throw new AppError(404, ERROR_CODES.SUPPLIER_NOT_FOUND);
  }

  const candidates = await tx.supplierInvoice.findMany({
    where: { supplierId, deletedAt: null, ...(input.invoiceId ? { id: input.invoiceId } : {}) },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: MAX_INVOICES_PER_SUPPLIER_PAYMENT,
    select: { id: true },
  });
  if (input.invoiceId && candidates.length === 0) {
    throw new AppError(404, ERROR_CODES.SUPPLIER_INVOICE_NOT_FOUND);
  }
  if (candidates.length === 0) {
    throw new AppError(409, ERROR_CODES.SUPPLIER_NOTHING_OWED);
  }

  // Locked in one fixed order, so two payments at once can neither deadlock nor overpay.
  if (input.save) {
    await tx.$queryRaw`SELECT id FROM "SupplierInvoice" WHERE id IN (${Prisma.join(candidates.map((c) => c.id))}) ORDER BY id FOR UPDATE`;
  }
  const invoices = await tx.supplierInvoice.findMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const owing = invoices
    .map((invoice) => ({ invoice, balance: invoiceBalance(invoice) }))
    .filter((i) => i.balance.greaterThan(0));
  const totalOwed = owing.reduce((sum, i) => sum.add(i.balance), ZERO_MONEY());
  if (totalOwed.isZero()) {
    throw new AppError(409, ERROR_CODES.SUPPLIER_NOTHING_OWED);
  }

  const amount = roundMoney(money(input.amount));
  if (amount.greaterThan(totalOwed)) {
    throw new AppError(400, ERROR_CODES.SUPPLIER_PAYMENT_EXCEEDS_BALANCE);
  }

  let left = amount;
  const allocations: SupplierPaymentAllocation[] = [];
  const recorded: SupplierPaymentRecorded[] = [];
  const at = new Date();

  for (const { invoice, balance } of owing) {
    if (left.lessThanOrEqualTo(0)) {
      break;
    }
    const share = left.greaterThan(balance) ? balance : left;
    left = roundMoney(left.sub(share));
    allocations.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: dateOnly(invoice.invoiceDate),
      amount: share.toFixed(MONEY_DECIMAL_PLACES),
      balanceBefore: balance.toFixed(MONEY_DECIMAL_PLACES),
      balanceAfter: roundMoney(balance.sub(share)).toFixed(MONEY_DECIMAL_PLACES),
    });
    if (input.save) {
      const payment = await tx.supplierPayment.create({
        data: {
          supplierId,
          invoiceId: invoice.id,
          amount: share,
          fromDrawer: input.fromDrawer,
          paidAt: at,
          note: input.note ?? null,
          paidById: input.userId,
        },
      });
      await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: roundMoney(invoice.paidAmount.add(share)) },
      });
      recorded.push({ paymentId: payment.id, invoiceId: invoice.id, amount: share });
    }
  }

  // What the shop owes this supplier on all invoices, after this payment.
  const all = await tx.supplierInvoice.findMany({
    where: { supplierId, deletedAt: null },
    select: { total: true, paidAmount: true },
  });
  const owed = all.reduce((sum, i) => sum.add(invoiceBalance(i)), ZERO_MONEY());
  return { allocations, recorded, balance: input.save ? roundMoney(owed) : roundMoney(owed.sub(amount)) };
}

// Cash paid to suppliers out of the till in a window: it leaves the drawer like a cash expense.
export async function supplierDrawerTotal(range: { from: Date; to: Date }): Promise<Money> {
  const sum = await prisma.supplierPayment.aggregate({
    where: { fromDrawer: true, paidAt: { gte: range.from, lt: range.to } },
    _sum: { amount: true },
  });
  return roundMoney(sum._sum.amount ?? ZERO_MONEY());
}
