import { z } from "zod";
import { booleanInput, decimalInput, paginationSchema } from "@/schemas/common";
import { reportTzOffsetSchema } from "@/schemas/report";
import { ERROR_CODES } from "@/constants/errors";
import {
  CASH_SESSION_DATE_PATTERN,
  CASH_SESSION_NOTE_MAX_LENGTH,
  CASH_SESSION_SORT_FIELDS,
  CASH_SESSION_STATUSES,
} from "@/constants/cash";

// The trading day, as a plain local calendar date — the same shape the
// reports take. The instants it covers are resolved from it plus the offset
// below, which is then frozen onto the session.
const cashSessionDateSchema = z
  .string()
  .regex(CASH_SESSION_DATE_PATTERN, ERROR_CODES.VALIDATION_INVALID_NUMBER)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
    message: ERROR_CODES.VALIDATION_INVALID_NUMBER,
  });

// Opening the day's drawer.
//
// `openingFloat` is optional and normally left out: the previous day's
// remainder carries over on its own, which is the whole point of recording a
// withdrawal at close. Sending it explicitly overrides that — for the very
// first day, or when the owner has put a different float in by hand.
export const openCashSessionSchema = z.object({
  date: cashSessionDateSchema.optional(),
  tzOffset: reportTzOffsetSchema,
  openingFloat: decimalInput.optional(),
  note: z.string().min(1).max(CASH_SESSION_NOTE_MAX_LENGTH).optional(),
});
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

// Closing it: what was physically counted, and what was taken out.
//
// The count is the only required field, and it is never refused for
// disagreeing with the expectation — a drawer that is short is a fact the
// shop needs recorded, not an error to be argued with. What IS required is a
// note explaining it (enforced on the backend, where the expectation is
// known), and the shop may carry the difference forward as a follow-up.
export const closeCashSessionSchema = z.object({
  countedAmount: decimalInput,
  withdrawnAmount: decimalInput.optional(),
  note: z.string().min(1).max(CASH_SESSION_NOTE_MAX_LENGTH).optional(),
  carryDifference: booleanInput.default(false),
});
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

export const listCashSessionsQuerySchema = paginationSchema.extend({
  status: z.enum(CASH_SESSION_STATUSES).optional(),
  // The follow-up list: closed days whose difference was carried and never
  // signed off.
  openFollowUpOnly: booleanInput.optional(),
  dateFrom: cashSessionDateSchema.optional(),
  dateTo: cashSessionDateSchema.optional(),
  sortBy: z.enum(CASH_SESSION_SORT_FIELDS).default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListCashSessionsQuery = z.infer<typeof listCashSessionsQuerySchema>;
