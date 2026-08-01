import { z } from "zod";
import { Role } from "@prisma/client";
import { isValidE164 } from "../lib/phone";
import { paginationSchema } from "./common";

const phoneSchema = z.string().refine(isValidE164, "error.validation.invalid_phone");

export const createUserSchema = z.object({
  name: z.string().min(1, "error.validation.required"),
  email: z.string().email("error.validation.invalid_email"),
  password: z.string().min(8, "error.validation.password_too_short"),
  role: z.nativeEnum(Role),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  idNumber: z.string().min(1).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional().nullable(),
  idNumber: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  // Admin-driven reset (CLAUDE.md rule 17) — no email self-reset flow exists.
  password: z.string().min(8, "error.validation.password_too_short").optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.nativeEnum(Role).optional(),
  isActive: z.coerce.boolean().optional(),
  q: z.string().min(1).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
