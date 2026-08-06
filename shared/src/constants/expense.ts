// Expenses (spec.md "Cash drawer & expenses"). What the shop spends, as
// opposed to what it sells: rent, salaries, a new steamer, the delivery
// company's fee. Kept apart from orders entirely — an expense has no stock,
// no customer and no channel.

// Where an expense sits in the approval flow. Anyone may RECORD one, but a
// record made by an Employee is a request until someone senior signs it off:
// the same anti-theft reasoning that keeps cancel/delete and "mark collected"
// out of their hands (spec.md "Security rationale"). An Admin's or Manager's
// own expense is APPROVED the moment it is written.
export const EXPENSE_APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

// The one status that counts as real money: a pending request has not been
// agreed to yet and a rejected one never happened, so neither may move the
// cash drawer or the profit figures.
export const COUNTED_EXPENSE_APPROVAL_STATUS = "APPROVED";

// What an Employee's expense opens as, versus everyone else's. Both sides of
// the rule live here so the backend gate and the UI's "this needs approval"
// wording can never disagree about it.
export const PENDING_EXPENSE_APPROVAL_STATUS = "PENDING";
export const APPROVED_EXPENSE_APPROVAL_STATUS = "APPROVED";
// What a refused request leaves behind. A rejected expense stays on the
// record — with who turned it down — rather than vanishing (spec.md).
export const REJECTED_EXPENSE_APPROVAL_STATUS = "REJECTED";

export const EXPENSE_SORT_FIELDS = ["date", "amount", "createdAt"] as const;

// The categories every shop starts with (backend/prisma/seed.ts upserts them
// by key). They are ordinary rows, not an enum: the list is the shop's to
// extend, rename and translate — the keys below are only what the seed
// guarantees exists.
export const DEFAULT_EXPENSE_CATEGORY_KEYS = [
  "utilities",
  "salaries",
  "supplies",
  "maintenance",
  "delivery",
] as const;

// Identity of a category is its key, never its translated name (CLAUDE.md
// rule 9): renaming "Supplies" in three languages must not orphan a single
// expense.
export const EXPENSE_CATEGORY_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
export const EXPENSE_CATEGORY_KEY_MAX_LENGTH = 40;

export const EXPENSE_NOTE_MAX_LENGTH = 500;
