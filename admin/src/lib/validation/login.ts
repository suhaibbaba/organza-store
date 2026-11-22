import { z } from "zod";
import { ERROR_CODES } from "@store/shared/constants/errors";

export const loginSchema = z.object({
  email: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED).email(ERROR_CODES.VALIDATION_INVALID_EMAIL),
  // Signing in only needs something typed: the length rule is for choosing a password, and the server decides.
  password: z.string().min(1, ERROR_CODES.VALIDATION_REQUIRED),
});

export type LoginInput = z.infer<typeof loginSchema>;
