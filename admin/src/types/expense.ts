import type { Expense, ExpenseApprovalStatus, ExpenseCategory, ExpenseSummary } from "@store/shared/types/expense";
import type { ListExpensesQuery } from "@store/shared/schemas/expense";
import type { ReportPresetKey } from "@/types/report";

export type { Expense, ExpenseApprovalStatus, ExpenseCategory, ExpenseSummary };

export interface ExpenseListFilters {
  preset: ReportPresetKey;
  from: string;
  to: string;
  q: string;
  categoryId: string | null;
  approvalStatus: ExpenseApprovalStatus | null;
  sortBy: ListExpensesQuery["sortBy"];
  sortDir: ListExpensesQuery["sortDir"];
  page: number;
  pageSize: number;
}

export type ExpenseFormTarget = { mode: "create" } | { mode: "edit"; expense: Expense };

export type ExpenseCategoryFormTarget = { mode: "create" } | { mode: "edit"; category: ExpenseCategory };

export interface ExpenseFormValues {
  amount: string;
  categoryId: string;
  date: string;
  paidInCash: boolean;
  isRecurring: boolean;
  note: string;
}

export interface ExpenseFormModalProps {
  target: ExpenseFormTarget | null;
  onClose: () => void;
}

export interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary;
}

export interface ExpenseCategoryBreakdownProps {
  summary: ExpenseSummary;
  categories: ExpenseCategory[];
  activeId: string | null;
  onSelect: (categoryId: string | null) => void;
}

export interface ExpenseCategoriesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
