import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@store/shared/constants/validation";

// Backend codes (rule 12), except the mismatch: a full message key, since the backend never sees the second box.
export const SET_PASSWORD_MISMATCH = "auth.setPassword.mismatch";

export const setPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
    confirm: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  })
  // Typed twice: a mistake here locks out a password only they will know.
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: SET_PASSWORD_MISMATCH,
  });

export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
