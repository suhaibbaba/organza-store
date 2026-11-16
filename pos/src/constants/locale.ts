import type { AppLocale } from "@/i18n/routing";

/**
 * Where the chosen language is remembered.
 *
 * A cookie, and not localStorage or the Cache API, for three reasons:
 *   - proxy.ts has to read it while deciding where an un-prefixed URL goes,
 *     which happens before a single byte of the page is rendered. Anything
 *     the server can't see would mean rendering in one language and
 *     correcting to another, with the direction flipping under the cashier.
 *   - the service worker empties its caches on every deploy (public/sw.js,
 *     `activate`). A preference kept in there would be wiped by the update
 *     that installs the new build — which is exactly when it was going
 *     missing.
 *   - it survives the app being closed, which a session cookie does not.
 *     next-intl's own default has no max-age, so on a phone the choice
 *     lasted until the POS was swiped away and no further.
 *
 * `NEXT_LOCALE` is next-intl's default name, kept so the cookie the proxy
 * reads is the same one the library writes — from the language switcher on a
 * soft navigation, and from the middleware on a hard one. The admin uses the
 * same name without clashing: each app owns its own host (both register a
 * service worker at scope "/", which two apps cannot share), so neither
 * origin can see the other's cookies.
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/** A year. Long enough that "durable" means what staff would expect it to. */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The whole app, and not the directory the cookie happened to be set from.
 *
 * Without this, a Set-Cookie sent while answering /ar/sell defaults to that
 * path — so the launch that matters most, the installed POS opening on "/",
 * is the one request that never sees it.
 */
export const LOCALE_COOKIE_PATH = "/";

// CLAUDE.md rule 9: ar/he render right-to-left; en left-to-right.
export const RTL_LOCALES: readonly AppLocale[] = ["ar", "he"];

export function getTextDirection(locale: AppLocale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export const LOCALE_LABELS: Record<AppLocale, string> = {
  ar: "العربية",
  en: "English",
  he: "עברית",
};
