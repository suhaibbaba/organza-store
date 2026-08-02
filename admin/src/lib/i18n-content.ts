import type { I18n } from "@shared/types/common";
import { DEFAULT_LANGUAGE } from "@shared/constants/languages";

// Resolves a translatable `{ ar, en, he }` field for display (CLAUDE.md rule
// 9): current locale, falling back to the default language, then to
// whatever's present, so a missing translation never renders blank.
export function localize(value: I18n | null | undefined, locale: string): string {
  if (!value) return "";
  const current = value[locale];
  if (current) return current;
  const fallback = value[DEFAULT_LANGUAGE];
  if (fallback) return fallback;
  return Object.values(value).find((v): v is string => Boolean(v)) ?? "";
}
