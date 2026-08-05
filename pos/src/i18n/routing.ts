import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@shared/constants/languages";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME } from "@/constants/locale";

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: "always",

  // The chosen language, kept for a year rather than for the life of the
  // app process. next-intl's default cookie carries no max-age, so closing
  // an installed POS — or updating it — threw the choice away and the next
  // launch fell back to whatever the phone was set to (English, on most of
  // them). See constants/locale.ts for why a cookie at all.
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
  },

  // The phone's own language never decides. A shop in Palestine runs in
  // Arabic (CLAUDE.md rule 9) whatever an imported handset was configured
  // with, so an install nobody has expressed a preference on must open in
  // the configured default — not in the browser's `Accept-Language`.
  //
  // Note this switch also turns off next-intl's cookie *reading*, which is
  // why proxy.ts resolves an un-prefixed URL itself: stored choice first,
  // default language second, and the header never.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
