import type { FieldError } from "react-hook-form";
import { BACKEND_ERROR_PREFIX, ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// Form errors carry backend error codes (rule 12); FormField wants the message key.
// A message that is already a screen key (a client-only check such as a password mismatch) passes through.
export function fieldErrorKey(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  const message = error.message ?? "";
  return ERROR_MESSAGE_KEYS[message] ?? (message.startsWith(BACKEND_ERROR_PREFIX) || !message ? FALLBACK_ERROR_MESSAGE_KEY : message);
}
