"use client";

import { useLocale, useTranslations } from "next-intl";
import { localizeI18n } from "@store/shared/lib/i18n";
import { useSettingsQuery } from "@/hooks/use-settings";

// The shop's own name from Settings; the system's name until it has loaded.
export function useStoreName(): string {
  const locale = useLocale();
  const tApp = useTranslations("app");
  const { data: settings } = useSettingsQuery();
  return localizeI18n(settings?.storeName, locale) || tApp("name");
}
