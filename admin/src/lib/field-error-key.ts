import type { FieldError } from "react-hook-form";
import { ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// Form errors carry backend error codes (rule 12); FormField wants the message key.
export function fieldErrorKey(error: FieldError | undefined): string | undefined {
  return error ? (ERROR_MESSAGE_KEYS[error.message ?? ""] ?? FALLBACK_ERROR_MESSAGE_KEY) : undefined;
}
