import { useTranslations } from "next-intl";
import { ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// The full message key for a backend error code (or a zod field-error message, which is the same code).
export function errorMessageKey(code: string): string {
  return ERROR_MESSAGE_KEYS[code] ?? FALLBACK_ERROR_MESSAGE_KEY;
}

export function useTranslateError() {
  const t = useTranslations();

  return (code: string, values?: Record<string, string | number>) => t(errorMessageKey(code), values);
}
