import type { MetadataRoute } from "next";
import { DEFAULT_LANGUAGE } from "@organza/shared/constants/languages";
import { getTextDirection } from "@/constants/locale";
import {
  PWA_BACKGROUND_COLOR,
  PWA_DESCRIPTION,
  PWA_ID,
  PWA_MANIFEST_ICON_SIZES,
  PWA_MASKABLE_ICON_PATH,
  PWA_MASKABLE_ICON_SIZE,
  PWA_NAME,
  PWA_SCOPE,
  PWA_SHORT_NAME,
  PWA_START_URL,
  PWA_THEME_COLOR,
  brandIconPath,
} from "@/constants/pwa";
import { fetchBranding } from "@/lib/branding";

// Served at /manifest.webmanifest. Linked from the root layout.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const hasUploadedIcon = Boolean((await fetchBranding())?.faviconUrls);
  return {
    id: PWA_ID,
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    start_url: PWA_START_URL,
    scope: PWA_SCOPE,
    // No browser chrome once installed — this is meant to feel like an app.
    display: "standalone",
    // Phones held upright; every screen is one mobile-first column.
    orientation: "portrait",
    // From DEFAULT_LANGUAGE, so changing it re-points the install too (rule 14).
    lang: DEFAULT_LANGUAGE,
    dir: getTextDirection(DEFAULT_LANGUAGE),
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      ...PWA_MANIFEST_ICON_SIZES.map((size) => ({
        src: brandIconPath(size),
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any" as const,
      })),
      // The built-in maskable art would win over an uploaded icon on Android, so it is offered only while there is none.
      ...(hasUploadedIcon
        ? []
        : [
            {
              src: PWA_MASKABLE_ICON_PATH,
              sizes: `${PWA_MASKABLE_ICON_SIZE}x${PWA_MASKABLE_ICON_SIZE}`,
              type: "image/png",
              purpose: "maskable" as const,
            },
          ]),
    ],
  };
}
