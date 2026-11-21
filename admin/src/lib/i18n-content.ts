import { localizeI18n } from "@store/shared/lib/i18n";
import type { I18n } from "@store/shared/types/common";

// Rule 9: current locale, then default, then anything present; the rule itself lives in shared.
export function localize(value: I18n | null | undefined, locale: string): string {
  return localizeI18n(value, locale);
}
