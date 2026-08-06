import { z } from "zod";
import { booleanInput, decimalInput, i18nSchema, paginationSchema } from "@/schemas/common";
import { ERROR_CODES } from "@/constants/errors";
import {
  EXPENSE_APPROVAL_STATUSES,
  EXPENSE_CATEGORY_KEY_MAX_LENGTH,
  EXPENSE_CATEGORY_KEY_PATTERN,
  EXPENSE_NOTE_MAX_LENGTH,
  EXPENSE_SORT_FIELDS,
} from "@/constants/expense";

// Expenses (spec.md "Cash drawer & expenses"). Note what the caller does NOT
// get to send: approvalStatus. Whether an expense is approved on the spot or
// opens as a request is decided by the caller's ROLE on the backend, never by
// the request body — otherwise "record an expense" would be a way to approve
// one.

// An amount has to be a real, positive sum: a zero expense is a typo and a
// negative one is a refund, which is not what this models.
const expenseAmountSchema = decimalInput.refine((v) => Number(v) > 0, {
  message: ERROR_CODES.VALIDATION_INVALID_NUMBER,
});

// When the money was actually spent. Accepts a plain date (YYYY-MM-DD, what
// a date picker gives) or a full timestamp; defaults to now, because the
// common case is writing a bill down as it is paid.
const expenseDateSchema = z.coerce.date();

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  amount: expenseAmountSchema,
  date: expenseDateSchema.optional(),
  note: z.string().min(1).max(EXPENSE_NOTE_MAX_LENGTH).optional(),
  // Only a cash expense moves the drawer; the default is cash because that
  // is what the shop mostly pays with.
  paidInCash: booleanInput.default(true),
  isRecurring: booleanInput.default(false),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  categoryId: z.string().min(1).optional(),
  amount: expenseAmountSchema.optional(),
  date: expenseDateSchema.optional(),
  note: z.string().min(1).max(EXPENSE_NOTE_MAX_LENGTH).nullish(),
  paidInCash: booleanInput.optional(),
  isRecurring: booleanInput.optional(),
});
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// Turning down someone else's expense. The note is what makes a rejection
// answerable ("we already paid that one"), so it is worth asking for — but
// it stays optional: refusing to record a refusal helps nobody.
export const rejectExpenseSchema = z.object({
  note: z.string().min(1).max(EXPENSE_NOTE_MAX_LENGTH).optional(),
});
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;

export const listExpensesQuerySchema = paginationSchema.extend({
  categoryId: z.string().min(1).optional(),
  approvalStatus: z.enum(EXPENSE_APPROVAL_STATUSES).optional(),
  paidInCash: booleanInput.optional(),
  isRecurring: booleanInput.optional(),
  // Inclusive range over the date the money was spent.
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  q: z.string().min(1).optional(),
  sortBy: z.enum(EXPENSE_SORT_FIELDS).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

// --- categories ------------------------------------------------------------

// The stable identifier a category is known by forever. Lowercase, no
// spaces: it is never shown to anyone, it is what the seed upserts against
// and what keeps a rename from orphaning past expenses (CLAUDE.md rule 9).
const expenseCategoryKeySchema = z
  .string()
  .min(1, ERROR_CODES.VALIDATION_REQUIRED)
  .max(EXPENSE_CATEGORY_KEY_MAX_LENGTH, ERROR_CODES.EXPENSE_CATEGORY_KEY_INVALID)
  .regex(EXPENSE_CATEGORY_KEY_PATTERN, ERROR_CODES.EXPENSE_CATEGORY_KEY_INVALID);

export const createExpenseCategorySchema = z.object({
  key: expenseCategoryKeySchema,
  name: i18nSchema,
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: booleanInput.optional(),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

// `key` is deliberately absent: it is frozen at creation, for the same
// reason a SKU is (CLAUDE.md rule 1). Rename the display name instead — it
// reaches every expense automatically, because nothing copies it.
export const updateExpenseCategorySchema = z.object({
  name: i18nSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: booleanInput.optional(),
});
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const listExpenseCategoriesQuerySchema = z.object({
  // The picker wants only the live ones; the management screen wants all.
  includeInactive: booleanInput.default(false),
});
export type ListExpenseCategoriesQuery = z.infer<typeof listExpenseCategoriesQuerySchema>;
