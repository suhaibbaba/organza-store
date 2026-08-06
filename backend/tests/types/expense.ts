// DTO shapes the expense suite reads back. Money crosses the API as 2dp
// strings, so every amount here is a string (never a float — CLAUDE.md).
export interface ExpenseCategoryDto {
  id: string;
  key: string;
  name: { ar: string; en?: string; he?: string };
  isActive: boolean;
  sortOrder: number;
  expenseCount?: number;
}

export interface ExpenseDto {
  id: string;
  categoryId: string;
  category: { id: string; key: string; name: Record<string, string> } | null;
  amount: string;
  date: string;
  note: string | null;
  paidInCash: boolean;
  isRecurring: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  createdById: string;
  createdBy: { id: string; name: string } | null;
  deletedAt: string | null;
}
