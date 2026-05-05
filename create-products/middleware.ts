import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const AUTH_COOKIE = "organza_token";
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9000";
const PUBLIC_PATHS = ["/login"];

function barePath(pathname: string) {
  return pathname.replace(/^\/(ar|en)/, "") || "/";
}
function detectLocale(pathname: string) {
  return pathname.startsWith("/en") ? "en" : "ar";
}
function isPublicPath(pathname: string) {
  const path = barePath(pathname);
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

async function verifyToken(token: string): Promise<boolean> {
  if (!token || token.length < 10) return false;
  try {
    const res = await fetch(`${MEDUSA_URL}/admin/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const locale = detectLocale(pathname);
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    if (token && (await verifyToken(token))) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
    if (token) {
      const res = intlMiddleware(request);
      res.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }
    return intlMiddleware(request);
  }

  if (!token) {
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (!(await verifyToken(token))) {
    const url = new URL(`/${locale}/login`, request.url);
    const res = NextResponse.redirect(url);
    res.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
