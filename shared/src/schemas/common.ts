import { z } from "zod";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants/pagination";
import { IMAGE_POINT_MAX, IMAGE_POINT_MIN } from "@/constants/validation";
import { ERROR_CODES } from "@/constants/errors";

// Translatable content { ar, en, he } — ar (default language) is required,
// en/he fall back to it when missing (CLAUDE.md rule 9).
export const i18nSchema = z.object({
  ar: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  en: z.string().min(1).optional(),
  he: z.string().min(1).optional(),
});

// Same shape but every language optional — used for optional fields like
// description, where at least one language must still be present if given.
export const i18nOptionalSchema = z
  .object({
    ar: z.string().min(1).optional(),
    en: z.string().min(1).optional(),
    he: z.string().min(1).optional(),
  })
  .refine((v) => Object.values(v).some(Boolean), { message: ERROR_CODES.VALIDATION_REQUIRED });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

// A boolean that survives the trip through a query string.
//
// NOT z.coerce.boolean(): that is `Boolean(value)`, and `Boolean("false")` is
// `true` — so `?paidInCash=false` would silently mean "yes". Harmless for a
// flag that is only ever switched on, wrong for any filter where `false` is a
// real answer, so this parses the words instead of casting them.
export const booleanInput = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

// Prisma Decimal fields accept number|string; coerce + bound-check here so
// invalid input never reaches the DB.
export const decimalInput = z
  .union([z.number(), z.string()])
  .transform((v) => String(v))
  .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: ERROR_CODES.VALIDATION_INVALID_NUMBER,
  });

// A point on the product image (numbered shawls, spec.md) — percentage of the
// image's displayed width/height, not pixels, so it stays correct at any
// screen size.
export const imagePointCoordinateSchema = z
  .number()
  .min(IMAGE_POINT_MIN, ERROR_CODES.VALIDATION_IMAGE_POINT_OUT_OF_RANGE)
  .max(IMAGE_POINT_MAX, ERROR_CODES.VALIDATION_IMAGE_POINT_OUT_OF_RANGE);
