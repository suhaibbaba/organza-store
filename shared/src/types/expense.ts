import type { EXPENSE_APPROVAL_STATUSES, EXPENSE_SORT_FIELDS } from "@/constants/expense";
import type { I18n } from "@/types/common";

export type ExpenseApprovalStatus = (typeof EXPENSE_APPROVAL_STATUSES)[number];
export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number];

// A category is an ordinary, editable row — the shop's own list, seeded with
// five to start from. Identity is `key` (stable, never translated), display
// is `name` (translatable), exactly like VariantType (CLAUDE.md rule 9).
export interface ExpenseCategory {
  id: string;
  key: string;
  name: I18n;
  // Retired rather than deleted once expenses have been filed under it: the
  // past has to keep making sense, so a category that is no longer used is
  // hidden from the picker instead of removed.
  isActive: boolean;
  sortOrder: number;
  // How many expenses are filed under it — what makes "can this be deleted"
  // answerable without a second request.
  expenseCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Who recorded (or signed off) an expense. Just id + name, like OrderCreator:
// nothing else about a staff member belongs on a financial record.
export interface ExpenseActor {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  category: Pick<ExpenseCategory, "id" | "key" | "name"> | null;
  // Money as a 2dp string, like everywhere else in the API.
  amount: string;
  // When the money was actually spent — not when the row was written. A bill
  // paid on the 30th and entered on the 2nd belongs to the 30th, both for the
  // drawer and for the month's figures.
  date: string;
  note: string | null;
  // Did it come out of the till? Only cash expenses move the drawer; a
  // transfer is just as real a cost, but the drawer never held that money.
  paidInCash: boolean;
  // A standing cost (rent, salaries, the internet) as opposed to a one-off
  // (a new mannequin). A label today — nothing is generated automatically —
  // so that "what do we pay every month" is answerable at all.
  isRecurring: boolean;
  approvalStatus: ExpenseApprovalStatus;
  approvedAt: string | null;
  approvedBy: ExpenseActor | null;
  createdById: string;
  createdBy: ExpenseActor | null;
  // Soft delete: an expense is a financial record, so it is hidden rather
  // than destroyed (the same reasoning as orders).
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
