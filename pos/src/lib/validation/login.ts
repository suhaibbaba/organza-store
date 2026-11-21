import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";

// Messages are backend error codes, rendered by useTranslateError.
export const loginSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Shape only: the API answers the same for unknown addresses, so the form must not reveal more.
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
