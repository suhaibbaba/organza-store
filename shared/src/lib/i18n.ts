import { DEFAULT_LANGUAGE } from "@/constants/languages";
import type { I18n } from "@/types/common";

/** Translatable field for display (rule 9): locale, then default language, then anything present, so it never renders blank. */
export function localizeI18n(value: I18n | null | undefined, locale: string): string {
  if (!value) {
    return "";
  }
  const current = value[locale];
  if (current) {
    return current;
  }
  const fallback = value[DEFAULT_LANGUAGE];
  if (fallback) {
    return fallback;
  }
  return Object.values(value).find((text): text is string => Boolean(text)) ?? "";
}
