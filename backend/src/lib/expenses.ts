import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMoney, money, roundMoney, ZERO_MONEY } from "@/lib/money";
import { COUNTED_EXPENSE_APPROVAL_STATUS, PENDING_EXPENSE_APPROVAL_STATUS } from "@/constants";
import type { AnyRecord, ExpenseAggregateRow, ExpenseSummary, ReportRange } from "@/types";

// ============================================================================
//  Expenses — what the shop spent.
//
//  One rule governs every figure here: ONLY APPROVED EXPENSES COUNT. A
//  pending request has not been agreed to and a rejected one never happened,
//  so neither may move the cash drawer or the profit figures. A soft-deleted
//  expense is gone from both as well.
// ============================================================================

// The WHERE every expense aggregate shares. Exported so the drawer and the
// reports can never drift into counting different rows as "real".
export function countedExpenseWhere(): Prisma.ExpenseWhereInput {
  return { deletedAt: null, approvalStatus: COUNTED_EXPENSE_APPROVAL_STATUS };
}

// Approved spending inside a window, split by whether it came out of the
// till. `total` feeds net profit (a transfer is just as real a cost);
// `cashTotal` feeds the drawer (which only ever held the cash half).
export async function queryExpenseTotals(range: ReportRange): Promise<ExpenseAggregateRow> {
  const rows = await prisma.$queryRaw<ExpenseAggregateRow[]>`
    SELECT
      COALESCE(SUM(amount), 0)                            AS "total",
      COALESCE(SUM(amount) FILTER (WHERE "paidInCash"), 0) AS "cashTotal"
    FROM "Expense"
    WHERE "deletedAt" IS NULL
      AND "approvalStatus" = ${COUNTED_EXPENSE_APPROVAL_STATUS}::"ExpenseApprovalStatus"
      AND date >= ${range.from}
      AND date < ${range.to}
  `;
  return rows[0];
}

export function expenseTotal(row: ExpenseAggregateRow | undefined): Prisma.Decimal {
  return roundMoney(row?.total === null || row?.total === undefined ? ZERO_MONEY() : money(row.total));
}

export function expenseCashTotal(row: ExpenseAggregateRow | undefined): Prisma.Decimal {
  return roundMoney(row?.cashTotal === null || row?.cashTotal === undefined ? ZERO_MONEY() : money(row.cashTotal));
}

function moneyText(value: Prisma.Decimal | null | undefined): string {
  return formatMoney(roundMoney(money(value ?? 0))) ?? "0.00";
}

// Approved spending under a filter, split by category and by cash; pending is counted apart and never added in.
export async function summarizeExpenses(where: Prisma.ExpenseWhereInput): Promise<ExpenseSummary> {
  const approved = { ...where, approvalStatus: COUNTED_EXPENSE_APPROVAL_STATUS } as Prisma.ExpenseWhereInput;
  const [byCategory, cash, pending] = await Promise.all([
    prisma.expense.groupBy({ by: ["categoryId"], where: approved, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expense.aggregate({ where: { ...approved, paidInCash: true }, _sum: { amount: true } }),
    prisma.expense.aggregate({
      where: { ...where, approvalStatus: PENDING_EXPENSE_APPROVAL_STATUS } as Prisma.ExpenseWhereInput,
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const total = byCategory.reduce((sum, row) => sum.plus(row._sum.amount ?? ZERO_MONEY()), ZERO_MONEY());
  return {
    total: moneyText(total),
    cashTotal: moneyText(cash._sum.amount),
    count: byCategory.reduce((sum, row) => sum + row._count._all, 0),
    pendingCount: pending._count._all,
    pendingAmount: moneyText(pending._sum.amount),
    byCategory: byCategory
      .map((row) => ({
        categoryId: row.categoryId,
        total: moneyText(row._sum.amount),
        count: row._count._all,
      }))
      .sort((a, b) => Number(b.total) - Number(a.total)),
  };
}

// --- serialization ---------------------------------------------------------

// Just id + name for whoever recorded or signed off an expense — nothing
// else about a staff member belongs on a financial record (the same shape,
// and the same reasoning, as an order's createdBy).
function actor(user: AnyRecord | null | undefined) {
  return user ? { id: user.id, name: user.name } : null;
}

export function serializeExpenseCategory(category: AnyRecord) {
  return {
    id: category.id,
    key: category.key,
    name: category.name,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    // Present only where the query counted them — it is what makes "can this
    // be deleted" answerable without a second request.
    ...(category._count?.expenses === undefined ? {} : { expenseCount: category._count.expenses }),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

// Nothing here is cost-gated: an expense is not a product's cost, it is the
// shop's own spending, and the permission that reaches this endpoint at all
// (expense.view) is already the gate.
export function serializeExpense(expense: AnyRecord) {
  return {
    id: expense.id,
    categoryId: expense.categoryId,
    category: expense.category
      ? { id: expense.category.id, key: expense.category.key, name: expense.category.name }
      : null,
    amount: formatMoney(expense.amount?.toString()),
    date: expense.date,
    note: expense.note,
    paidInCash: expense.paidInCash,
    isRecurring: expense.isRecurring,
    approvalStatus: expense.approvalStatus,
    approvedAt: expense.approvedAt ?? null,
    approvedBy: actor(expense.approvedBy),
    createdById: expense.createdById,
    createdBy: actor(expense.createdBy),
    deletedAt: expense.deletedAt ?? null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}
