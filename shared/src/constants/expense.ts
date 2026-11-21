// Expenses (spec.md "Cash drawer & expenses"): what the shop spends, kept apart from orders entirely.

// An Employee's expense is a request until approved; an Admin's or Manager's is APPROVED when written (spec.md "Security rationale").
export const EXPENSE_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

// Only APPROVED expenses count as money: pending and rejected never move the drawer or profit.
export const COUNTED_EXPENSE_APPROVAL_STATUS = "APPROVED";

// Both sides of the rule live here so the backend gate and the UI wording cannot disagree.
export const PENDING_EXPENSE_APPROVAL_STATUS = "PENDING";
export const APPROVED_EXPENSE_APPROVAL_STATUS = "APPROVED";
// A rejected expense stays on the record, with who turned it down.
export const REJECTED_EXPENSE_APPROVAL_STATUS = "REJECTED";

export const EXPENSE_SORT_FIELDS = ["date", "amount", "createdAt"] as const;

// Starting categories, created by bootstrap by key; ordinary rows the shop may extend, rename and translate.
export const DEFAULT_EXPENSE_CATEGORY_KEYS = ["utilities", "salaries", "supplies", "maintenance", "delivery"] as const;

// A category's identity is its key, never its translated name (CLAUDE.md rule 9).
export const EXPENSE_CATEGORY_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
export const EXPENSE_CATEGORY_KEY_MAX_LENGTH = 40;

export const EXPENSE_NOTE_MAX_LENGTH = 500;
