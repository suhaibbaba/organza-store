import type { AppLocale } from "@/i18n/routing";

// CLAUDE.md rule 9: ar/he render right-to-left; en left-to-right.
export const RTL_LOCALES: readonly AppLocale[] = ["ar", "he"];

export function getTextDirection(locale: AppLocale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ar: "العربية",
  en: "English",
  he: "עברית",
};
