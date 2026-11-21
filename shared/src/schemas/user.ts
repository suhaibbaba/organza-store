import { z } from "zod";
import { phoneSchema } from "@/schemas/phone";
import { booleanInput, paginationSchema } from "@/schemas/common";
import { ERROR_CODES } from "@/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@/constants/validation";
import { ROLES } from "@/constants/roles";
import { USER_SORT_FIELDS } from "@/constants/user";
import { SORT_DIRECTIONS } from "@/constants/pagination";

export const createUserSchema = z.object({
  name: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  email: z.string().email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  // Optional: left out, the account gets no password and its owner sets one from an emailed link (rule 17).
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT).optional(),
  role: z.enum(ROLES),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  idNumber: z.string().min(1).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional().nullable(),
  idNumber: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  // Admin-driven reset (CLAUDE.md rule 17) — no email self-reset flow exists.
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  isActive: booleanInput.optional(),
  q: z.string().min(1).optional(),
  sortBy: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(SORT_DIRECTIONS).default("desc"),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
