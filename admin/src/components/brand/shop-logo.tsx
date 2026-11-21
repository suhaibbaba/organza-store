"use client";

import { useSettingsQuery } from "@/hooks/use-settings";
import { useStoreName } from "@/hooks/use-store-name";
import { resolveImageUrl } from "@/lib/image-fallback";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";
import { cn } from "@/lib/utils";

// The logo uploaded in Settings; the app icon until one is.
export function ShopLogo({ className }: { className?: string }) {
  const logoUrl = useSettingsQuery().data?.logoUrl;
  const alt = useStoreName();
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an already-optimised WebP served by the API
    <img
      src={logoUrl ? resolveImageUrl(logoUrl) : pwaIconPath(LOGO_ICON_SIZE)}
      alt={alt}
      className={cn("object-contain", className)}
      data-test-selector="shop-logo"
    />
  );
}
