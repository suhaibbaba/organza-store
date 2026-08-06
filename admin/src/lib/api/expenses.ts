import type { Expense } from "@shared/types/expense";
import { PENDING_EXPENSE_APPROVAL_STATUS } from "@shared/constants/expense";
import { apiFetch } from "@/lib/api/client";

// How many expenses are waiting for someone to sign them off (spec.md "Cash
// drawer & expenses": an Employee's expense is a request until approved).
//
// Asks for a single row and reads the total off the envelope's pagination
// rather than pulling the list: the dashboard only shows the count.
export async function fetchPendingExpenseCount(): Promise<number> {
  const params = new URLSearchParams({
    approvalStatus: PENDING_EXPENSE_APPROVAL_STATUS,
    page: "1",
    pageSize: "1",
  });
  const { meta } = await apiFetch<Expense[]>(`/api/expenses?${params.toString()}`);
  return meta?.total ?? 0;
}
