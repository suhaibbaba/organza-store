import { localizeI18n } from "@organza/shared/lib/i18n";
import type { I18n } from "@organza/shared/types/common";

// Resolves a translatable `{ ar, en, he }` field for display (CLAUDE.md rule
// 9): current locale, falling back to the default language, then to
// whatever's present, so a missing translation never renders blank.
//
// The rule itself lives in the shared package — admin and pos both quote the
// same note, and they must fall back to the same language when it was only
// written in one.
export function localize(value: I18n | null | undefined, locale: string): string {
  return localizeI18n(value, locale);
}
