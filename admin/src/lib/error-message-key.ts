import { ApiError } from "@/lib/api/errors";
import { ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// A toast takes a message key, never a backend code: `error.category.has_children` → `errors.categoryHasChildren`.
export function errorMessageKey(error: unknown): string {
  return (error instanceof ApiError && ERROR_MESSAGE_KEYS[error.code]) || FALLBACK_ERROR_MESSAGE_KEY;
}
