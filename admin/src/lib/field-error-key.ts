import type { FieldError } from "react-hook-form";
import { BACKEND_ERROR_PREFIX, ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// Maps a form error's backend code to its message key; a client-only key such as a password mismatch passes through.
export function fieldErrorKey(error: FieldError | undefined): string | undefined {
  if (!error) {
    return undefined;
  }
  const message = error.message ?? "";
  return (
    ERROR_MESSAGE_KEYS[message] ??
    (message.startsWith(BACKEND_ERROR_PREFIX) || !message ? FALLBACK_ERROR_MESSAGE_KEY : message)
  );
}
