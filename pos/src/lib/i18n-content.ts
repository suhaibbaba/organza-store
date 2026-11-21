import { localizeI18n } from "@store/shared/lib/i18n";
import type { I18n } from "@store/shared/types/common";

// Rule 9: current locale, then the default language, then anything present, so a field never renders blank.
export function localize(value: I18n | null | undefined, locale: string): string {
  return localizeI18n(value, locale);
}
