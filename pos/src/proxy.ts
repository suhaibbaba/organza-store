import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_TOKEN_KEY } from "@/constants/storage";
import { OFFLINE_PATH } from "@/constants/pwa";

const handleIntl = createMiddleware(routing);

const LOGIN_PATH = "/login";
// The POS has exactly one screen, so a signed-in user always belongs here.
const HOME_PATH = "/sell";
// Reachable without a session. /offline is in here because the service worker
// precaches it while nobody may be signed in yet, and a cached
// redirect-to-login is useless as an offline fallback.
const PUBLIC_PATHS = [LOGIN_PATH, OFFLINE_PATH];

// Optimistic-only check (see Next.js auth guide: "Optimistic checks with
// Proxy"). It just avoids a flash of protected UI — AuthGuard verifies the
// token against the backend on every load, and every API route re-checks it
// server-side regardless (CLAUDE.md rule 5).
export function proxy(request: NextRequest): NextResponse {
  const intlResponse = handleIntl(request);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (!localeMatch) {
    // No locale prefix yet — let next-intl redirect to the prefixed URL
    // first; the redirected request re-enters proxy with a locale segment.
    return intlResponse;
  }
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
  if (rest === LOGIN_PATH && hasToken) {
    const sellUrl = new URL(`/${locale}${HOME_PATH}`, request.url);
    return NextResponse.redirect(sellUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
