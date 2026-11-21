import type { Prisma } from "@prisma/client";
import type {
  Expense,
  ExpenseActor,
  ExpenseApprovalStatus,
  ExpenseCategory,
  ExpenseCategoryTotal,
  ExpenseSortField,
  ExpenseSummary,
} from "@store/shared/types/expense";

export type {
  Expense,
  ExpenseActor,
  ExpenseApprovalStatus,
  ExpenseCategory,
  ExpenseCategoryTotal,
  ExpenseSortField,
  ExpenseSummary,
};

// Raw expense aggregate (Prisma.Decimal), converted only in lib/expenses.ts.
export interface ExpenseAggregateRow {
  total: Prisma.Decimal | null;
  cashTotal: Prisma.Decimal | null;
}
