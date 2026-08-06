import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@shared/constants/languages";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME, LOCALE_COOKIE_PATH } from "@/constants/locale";

export const routing = defineRouting({
  locales: SUPPORTED_LANGUAGES,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: "always",

  // The chosen language, kept for a year and for the whole app rather than
  // for the life of the app process. next-intl's default cookie carries no
  // max-age and no path, so closing an installed POS — or updating it —
  // threw the choice away and the next launch fell back to whatever the
  // phone was set to (English, on most of them). See constants/locale.ts for
  // why a cookie at all, and why both attributes matter.
  //
  // This is also what persists a switch: picking a language calls
  // router.replace(..., { locale }) (components/layout/language-switcher.tsx),
  // and next-intl writes this cookie as it goes.
  localeCookie: {
    name: LOCALE_COOKIE_NAME,
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    path: LOCALE_COOKIE_PATH,
    sameSite: "lax",
  },

  // The phone's own language never decides. A shop in Palestine runs in
  // Arabic (CLAUDE.md rule 9) whatever an imported handset was configured
  // with, so an install nobody has expressed a preference on must open in
  // the configured default — not in the browser's `Accept-Language`.
  //
  // Note this switch also turns off next-intl's cookie *reading*, which is
  // why proxy.ts resolves an un-prefixed URL itself: stored choice first,
  // default language second, and the header never. Writing the cookie is
  // unaffected — that is governed by `localeCookie` above.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
