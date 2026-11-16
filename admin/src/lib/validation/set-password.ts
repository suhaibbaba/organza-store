import { z } from "zod";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@organza/shared/constants/validation";

// Field messages are backend error codes (CLAUDE.md rule 12) so they render
// through the same errors.* catalogue as every other form — except the
// mismatch, which has no backend equivalent because the backend never sees
// the second box.
export const SET_PASSWORD_MISMATCH = "form.password.mismatch";

export const setPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
    confirm: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  })
  // Typed twice on purpose: this is the one screen where getting it wrong
  // locks somebody out of a password only they were ever going to know.
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: SET_PASSWORD_MISMATCH,
  });

export type SetPasswordValues = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
