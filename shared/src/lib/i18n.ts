import { DEFAULT_LANGUAGE } from "@/constants/languages";
import type { I18n } from "@/types/common";

/**
 * Resolves a translatable `{ ar, en, he }` field for display (CLAUDE.md rule
 * 9): the current locale, falling back to the default language, then to
 * whatever is present — so a missing translation never renders blank, and a
 * shop that only ever writes Arabic is readable in every locale.
 *
 * Shared rather than one copy per app: admin and pos had the same function
 * twice, and a note written in Arabic alone has to fall back identically on
 * the product screen and on the POS tile that quotes it.
 */
export function localizeI18n(value: I18n | null | undefined, locale: string): string {
  if (!value) return "";
  const current = value[locale];
  if (current) return current;
  const fallback = value[DEFAULT_LANGUAGE];
  if (fallback) return fallback;
  return Object.values(value).find((text): text is string => Boolean(text)) ?? "";
}
