"use client";

import { useEffect } from "react";
import { PWA_APPLE_ICON_SIZE, PWA_FAVICON_PNG_SIZES, pwaIconPath } from "@/constants/pwa";
import { useSettingsQuery } from "@/hooks/use-settings";
import { resolveImageUrl } from "@/lib/image-fallback";

// The <head> icons point at /brand-icon (cached for minutes); this swaps them the moment a Save changes the favicon.
export function BrandIconSync(): null {
  const faviconUrls = useSettingsQuery().data?.faviconUrls;

  useEffect(() => {
    if (faviconUrls === undefined) {
      return;
    }
    const [tabSize] = PWA_FAVICON_PNG_SIZES;
    const tab = faviconUrls ? resolveImageUrl(faviconUrls[tabSize]) : pwaIconPath(tabSize);
    const apple = faviconUrls ? resolveImageUrl(faviconUrls[PWA_APPLE_ICON_SIZE]) : pwaIconPath(PWA_APPLE_ICON_SIZE);
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => (link.href = tab));
    document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => (link.href = apple));
  }, [faviconUrls]);
  return null;
}
