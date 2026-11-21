import type { Expense, ExpenseCategory, ExpenseSummary } from "@store/shared/types/expense";
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from "@store/shared/schemas/expense";
import type { Pagination } from "@store/shared/types/common";
import { apiFetch } from "@/lib/api/client";
import { rangeForPreset } from "@/lib/report-range";
import type { ExpenseListFilters } from "@/types/expense";

// The picked days are local; the API compares instants, so the range runs from local midnight to the day's last moment.
function rangeParams(filters: ExpenseListFilters): URLSearchParams {
  const range = rangeForPreset(filters.preset, filters);
  const params = new URLSearchParams({
    dateFrom: new Date(`${range.from}T00:00:00`).toISOString(),
    dateTo: new Date(`${range.to}T23:59:59.999`).toISOString(),
  });
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }
  return params;
}

export async function fetchExpenses(
  filters: ExpenseListFilters,
): Promise<{ expenses: Expense[]; meta: Pagination | null }> {
  const params = rangeParams(filters);
  if (filters.approvalStatus) {
    params.set("approvalStatus", filters.approvalStatus);
  }
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const { data, meta } = await apiFetch<Expense[]>(`/api/expenses?${params.toString()}`);
  return { expenses: data, meta };
}

export async function fetchExpenseSummary(filters: ExpenseListFilters): Promise<ExpenseSummary> {
  const { data } = await apiFetch<ExpenseSummary>(`/api/expenses/summary?${rangeParams(filters).toString()}`);
  return data;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const { data } = await apiFetch<Expense>("/api/expenses", { method: "POST", body: input });
  return data;
}

export async function updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
  const { data } = await apiFetch<Expense>(`/api/expenses/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function deleteExpense(id: string): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>(`/api/expenses/${id}`, { method: "DELETE" });
  return data;
}

export async function fetchExpenseCategories(includeInactive: boolean): Promise<ExpenseCategory[]> {
  const { data } = await apiFetch<ExpenseCategory[]>(`/api/expense-categories?includeInactive=${includeInactive}`);
  return data;
}

export async function createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
  const { data } = await apiFetch<ExpenseCategory>("/api/expense-categories", { method: "POST", body: input });
  return data;
}

export async function updateExpenseCategory(id: string, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory> {
  const { data } = await apiFetch<ExpenseCategory>(`/api/expense-categories/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function deleteExpenseCategory(id: string): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>(`/api/expense-categories/${id}`, { method: "DELETE" });
  return data;
}
