import type { Prisma } from "@prisma/client";
import type {
  Expense,
  ExpenseActor,
  ExpenseApprovalStatus,
  ExpenseCategory,
  ExpenseSortField,
} from "@organza/shared/types/expense";

export type { Expense, ExpenseActor, ExpenseApprovalStatus, ExpenseCategory, ExpenseSortField };

// The raw aggregate behind the expense figures on a report. Postgres hands
// numeric back as Prisma.Decimal; lib/expenses.ts is the only place that
// converts it (same convention as the report rows).
export interface ExpenseAggregateRow {
  total: Prisma.Decimal | null;
  cashTotal: Prisma.Decimal | null;
}
