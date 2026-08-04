import { z } from "zod";
import { ERROR_CODES } from "@/constants/errors";
import { MS_PER_DAY } from "@/constants/time";
import {
  DEFAULT_TOP_SELLERS_LIMIT,
  MAX_REPORT_RANGE_DAYS,
  MAX_TOP_SELLERS_LIMIT,
  REPORT_DATE_PATTERN,
  REPORT_TZ_OFFSET_MAX_MINUTES,
  REPORT_TZ_OFFSET_MIN_MINUTES,
} from "@/constants/report";

// Minutes to ADD to UTC to reach the viewer's local time — the client sends
// `-new Date().getTimezoneOffset()`, so "today" on the dashboard means today
// where the phone is, not in UTC. Defaults to UTC when omitted.
export const reportTzOffsetSchema = z.coerce
  .number()
  .int()
  .min(REPORT_TZ_OFFSET_MIN_MINUTES, ERROR_CODES.VALIDATION_INVALID_NUMBER)
  .max(REPORT_TZ_OFFSET_MAX_MINUTES, ERROR_CODES.VALIDATION_INVALID_NUMBER)
  .default(0);

export const salesSummaryQuerySchema = z.object({
  tzOffset: reportTzOffsetSchema,
});
export type SalesSummaryQuery = z.infer<typeof salesSummaryQuerySchema>;

// A plain local calendar date (YYYY-MM-DD) — what a date picker produces.
// The backend turns it into instants with the offset above; sending a full
// timestamp would just re-introduce the timezone question the offset answers.
const reportDateSchema = z
  .string()
  .regex(REPORT_DATE_PATTERN, ERROR_CODES.REPORT_RANGE_INVALID)
  // Well-formed but impossible dates (2026-02-31) look fine to the pattern.
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { message: ERROR_CODES.REPORT_RANGE_INVALID });

export const salesReportQuerySchema = z
  .object({
    from: reportDateSchema,
    to: reportDateSchema,
    tzOffset: reportTzOffsetSchema,
    // Best sellers are a bounded top-N rather than a paged list (CLAUDE.md
    // rule 15's "never return unbounded lists" — this is the bound).
    topLimit: z.coerce
      .number()
      .int()
      .min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER)
      .max(MAX_TOP_SELLERS_LIMIT, ERROR_CODES.VALIDATION_INVALID_NUMBER)
      .default(DEFAULT_TOP_SELLERS_LIMIT),
  })
  .refine((v) => v.from <= v.to, { message: ERROR_CODES.REPORT_RANGE_INVALID })
  .refine((v) => (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / MS_PER_DAY < MAX_REPORT_RANGE_DAYS, {
    message: ERROR_CODES.REPORT_RANGE_TOO_LONG,
  });
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
