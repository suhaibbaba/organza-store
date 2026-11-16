import { z } from "zod";
import { ERROR_CODES } from "@/constants/errors";
import { PASSWORD_MIN_LENGTH } from "@/constants/validation";

// "I forgot my password" — the public entry point. Deliberately answers the
// same way whether or not the address belongs to an account (see
// backend/src/routes/passwordSetup.ts), so nothing here may be strict enough
// to tell an attacker that a given address was at least well-formed-and-known.
export const requestPasswordResetSchema = z.object({
  email: z.string().email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

// Redeeming the emailed link. The token is the whole authentication — it is
// single-use and time-limited, and is never written to a log.
export const completePasswordSetupSchema = z.object({
  token: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
  password: z.string().min(PASSWORD_MIN_LENGTH, ERROR_CODES.VALIDATION_PASSWORD_TOO_SHORT),
});
export type CompletePasswordSetupInput = z.infer<typeof completePasswordSetupSchema>;
