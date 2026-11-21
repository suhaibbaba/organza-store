import { NextResponse, type NextRequest } from "next/server";
import { FAVICON_SIZES } from "@store/shared/constants/brand";
import type { FaviconSize } from "@store/shared/types/setting";
import { BRAND_ICON_CACHE_SECONDS, pwaIconPath } from "@/constants/pwa";
import { fetchBranding } from "@/lib/branding";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function iconSize(file: string): FaviconSize | null {
  const size = Number(file.replace(/\.png$/, ""));
  return (FAVICON_SIZES as readonly number[]).includes(size) ? (size as FaviconSize) : null;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/brand-icon/[file]">) {
  const size = iconSize((await ctx.params).file);
  if (size === null) return new NextResponse(null, { status: 404 });

  const uploaded = (await fetchBranding())?.faviconUrls?.[size];
  const target = uploaded ? new URL(uploaded, API_BASE_URL) : new URL(pwaIconPath(size), request.url);
  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", `public, max-age=${BRAND_ICON_CACHE_SECONDS}`);
  return response;
}
