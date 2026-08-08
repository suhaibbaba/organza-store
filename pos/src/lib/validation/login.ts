import { z } from "zod";
import { ERROR_CODES } from "@shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@shared/constants/validation";

// Field messages are backend error codes (e.g. "error.validation.required"),
// same as every other error in the app — see useTranslateError.
export const loginSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
});

export type LoginInput = z.infer<typeof loginSchema>;

// "I forgot my password" — the only field is the mailbox the link goes to.
// Nothing stricter than a shape check: the API deliberately answers the same
// whether or not the address belongs to an account, and a form that refused
// unknown-looking addresses would give that away.
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
