import type { Expense } from "@store/shared/types/expense";
import { PENDING_EXPENSE_APPROVAL_STATUS } from "@store/shared/constants/expense";
import { apiFetch } from "@/lib/api/client";

// Reads the total off one row's pagination: the dashboard shows only the count.
export async function fetchPendingExpenseCount(): Promise<number> {
  const params = new URLSearchParams({
    approvalStatus: PENDING_EXPENSE_APPROVAL_STATUS,
    page: "1",
    pageSize: "1",
  });
  const { meta } = await apiFetch<Expense[]>(`/api/expenses?${params.toString()}`);
  return meta?.total ?? 0;
}
