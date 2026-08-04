import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@shared/constants/languages";

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
