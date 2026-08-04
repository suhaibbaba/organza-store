import { useTranslations } from "next-intl";
import { ERROR_MESSAGE_KEYS, FALLBACK_ERROR_MESSAGE_KEY } from "@/constants/errorMessages";

// Turns a backend error code (or a zod field-error message, which is the
// same code) into display text via the flat `errors.*` message namespace.
export function useTranslateError() {
  const t = useTranslations();

  return (code: string, values?: Record<string, string | number>) => {
    const key = ERROR_MESSAGE_KEYS[code] ?? FALLBACK_ERROR_MESSAGE_KEY;
    return t(key, values);
  };
}
