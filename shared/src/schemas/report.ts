import { z } from "zod";
import { ERROR_CODES } from "@/constants/errors";
import { MS_PER_DAY } from "@/constants/time";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants/pagination";
import {
  DEFAULT_SOLD_ITEMS_SORT,
  DEFAULT_TOP_SELLERS_LIMIT,
  MAX_REPORT_RANGE_DAYS,
  MAX_TOP_SELLERS_LIMIT,
  REPORT_DATE_PATTERN,
  REPORT_TZ_OFFSET_MAX_MINUTES,
  REPORT_TZ_OFFSET_MIN_MINUTES,
  SOLD_ITEMS_SORTS,
} from "@/constants/report";

// Minutes to add to UTC for the viewer's local time (-getTimezoneOffset()), so "today" is the phone's today; default UTC.
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

// A plain local date (YYYY-MM-DD), turned into instants with the offset above.
const reportDateSchema = z
  .string()
  .regex(REPORT_DATE_PATTERN, ERROR_CODES.REPORT_RANGE_INVALID)
  // Well-formed but impossible dates (2026-02-31) look fine to the pattern.
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { message: ERROR_CODES.REPORT_RANGE_INVALID });

// A picked range must run forwards and fit MAX_REPORT_RANGE_DAYS.
interface PickedRange {
  from: string;
  to: string;
}
const RUNS_FORWARDS = [(v: PickedRange) => v.from <= v.to, { message: ERROR_CODES.REPORT_RANGE_INVALID }] as const;
const FITS_MAX_DAYS = [
  (v: PickedRange) =>
    (Date.parse(`${v.to}T00:00:00Z`) - Date.parse(`${v.from}T00:00:00Z`)) / MS_PER_DAY < MAX_REPORT_RANGE_DAYS,
  { message: ERROR_CODES.REPORT_RANGE_TOO_LONG },
] as const;

const rangeFields = {
  from: reportDateSchema,
  to: reportDateSchema,
  tzOffset: reportTzOffsetSchema,
};

export const salesReportQuerySchema = z
  .object({
    ...rangeFields,
    // Best sellers are a bounded top-N (rule 15).
    topLimit: z.coerce
      .number()
      .int()
      .min(1, ERROR_CODES.VALIDATION_INVALID_NUMBER)
      .max(MAX_TOP_SELLERS_LIMIT, ERROR_CODES.VALIDATION_INVALID_NUMBER)
      .default(DEFAULT_TOP_SELLERS_LIMIT),
  })
  .refine(...RUNS_FORWARDS)
  .refine(...FITS_MAX_DAYS);
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

// GET /api/reports/period — the Sales log's totals for one range.
export const salesPeriodQuerySchema = z
  .object(rangeFields)
  .refine(...RUNS_FORWARDS)
  .refine(...FITS_MAX_DAYS);
export type SalesPeriodQuery = z.infer<typeof salesPeriodQuerySchema>;

// GET /api/reports/sold-items — every piece sold in the range, paginated and sorted (rule 15).
export const soldItemsQuerySchema = z
  .object({
    ...rangeFields,
    sortBy: z.enum(SOLD_ITEMS_SORTS).default(DEFAULT_SOLD_ITEMS_SORT),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine(...RUNS_FORWARDS)
  .refine(...FITS_MAX_DAYS);
export type SoldItemsQuery = z.infer<typeof soldItemsQuerySchema>;
