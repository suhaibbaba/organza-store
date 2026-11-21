import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@store/shared/constants/languages";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME, LOCALE_COOKIE_PATH } from "@/constants/locale";

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: "always",

  // A year and the whole app: next-intl's default cookie lost the choice whenever the installed POS closed or updated.
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: LOCALE_COOKIE_PATH,
    sameSite: "lax",
  },

  // The phone's language never decides: an install with no stated preference opens in the shop default (rule 9).
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
