import { z } from "zod";
import { phoneSchema } from "@/schemas/phone";
import { ERROR_CODES } from "@/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@/constants/validation";
import { SUPPORTED_LANGUAGES } from "@/constants/languages";

// What a signed-in person may change on their own account; email and role stay with an Admin.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, ERROR_CODES.VALIDATION_REQUIRED).optional(),
    phone: phoneSchema.optional(),
    whatsapp: phoneSchema.optional().nullable(),
    locale: z.enum(SUPPORTED_LANGUAGES).optional(),
  })
  .strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
