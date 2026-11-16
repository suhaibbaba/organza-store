import { z } from "zod";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@organza/shared/constants/validation";

// Field messages are backend error codes (e.g. "error.validation.required"),
// same as every other error in the app — see useTranslateError.
export const loginSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
});

export type LoginInput = z.infer<typeof loginSchema>;
