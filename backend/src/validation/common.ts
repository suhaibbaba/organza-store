import { z } from "zod";

// Translatable content { ar, en, he } — ar (default language) is required,
// en/he fall back to it when missing (CLAUDE.md rule 9).
export const i18nSchema = z.object({
  ar: z.string().min(1, "error.validation.required"),
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
  .refine((v) => Object.values(v).some(Boolean), { message: "error.validation.required" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Prisma Decimal fields accept number|string; coerce + bound-check here so
// invalid input never reaches the DB.
export const decimalInput = z
  .union([z.number(), z.string()])
  .transform((v) => String(v))
  .refine((v) => v.trim() !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: "error.validation.invalid_number",
  });
