import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_COOKIE_NAME } from "@/constants/locale";
import { SESSION_TOKEN_KEY } from "@/constants/storage";
import { OFFLINE_PATH } from "@/constants/pwa";
import { FORGOT_PASSWORD_PATH, PASSWORD_SETUP_PATH } from "@/constants/auth";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";

const handleIntl = createMiddleware(routing);

const LOGIN_PATH = "/login";
// Reachable without a session. /offline is in here because the service worker
// precaches it while nobody may be signed in yet, and a cached
// redirect-to-login is useless as an offline fallback.
//
// The two password screens are here for the reason the whole flow exists:
// somebody who has no password yet — or has forgotten theirs — cannot sign in
// to reach the page where they would set one.
const PUBLIC_PATHS = [LOGIN_PATH, OFFLINE_PATH, `/${PASSWORD_SETUP_PATH}`, FORGOT_PASSWORD_PATH];

// The language an un-prefixed URL should open in: what this device last
// chose, and otherwise the shop's own default. Deliberately not the phone's
// `Accept-Language` — see i18n/routing.ts.
//
// Read here, in the proxy, so the decision is made before anything renders:
// the redirect lands on a URL that already carries the locale, and the very
// first paint has the right language and the right direction. Nothing has to
// be corrected on the client, so there is no flash of English or of LTR.
function preferredLocale(request: NextRequest): AppLocale {
  const stored = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  return hasLocale(routing.locales, stored) ? stored : routing.defaultLocale;
}

// Optimistic-only check (see Next.js auth guide: "Optimistic checks with
// Proxy"). It just avoids a flash of protected UI — AuthGuard verifies the
// token against the backend on every load, and every API route re-checks it
// server-side regardless (CLAUDE.md rule 5).
export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);

  if (!localeMatch) {
    // No locale in the URL — the installed app's start_url ("/") every time
    // it is launched from the home screen. Send it to the remembered
    // language; the redirected request comes back through here with a
    // prefix and carries on below.
    const target = request.nextUrl.clone();
    target.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(target);
  }

  const intlResponse = handleIntl(request);
  const locale = localeMatch[1];
  const rest = localeMatch[2] ?? "/";

  const hasToken = Boolean(request.cookies.get(SESSION_TOKEN_KEY)?.value);
  const isPublicPath = PUBLIC_PATHS.includes(rest);

  if (!isPublicPath && !hasToken) {
    const loginUrl = new URL(`/${locale}${LOGIN_PATH}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Only the login screen bounces a signed-in user onwards; /offline has to
  // keep rendering for them too, since that's exactly who sees it.
  //
  // Sent to the same place the root path sends an unknown role, and for the
  // same reason: a cookie says somebody is signed in, but not who — the role
  // lives behind a request this runtime does not make. RoleGuard forwards
  // whoever may not open it (an Employee lands on Orders).
  if (rest === LOGIN_PATH && hasToken) {
    const landingUrl = new URL(`/${locale}${DEFAULT_LANDING_HREF}`, request.url);
    return NextResponse.redirect(landingUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
