import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_TOKEN_KEY } from "@/constants/storage";

const handleIntl = createMiddleware(routing);

const PUBLIC_PATH = "/login";

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
  const isPublicPath = rest === PUBLIC_PATH;

  if (!isPublicPath && !hasToken) {
    const loginUrl = new URL(`/${locale}${PUBLIC_PATH}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicPath && hasToken) {
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
