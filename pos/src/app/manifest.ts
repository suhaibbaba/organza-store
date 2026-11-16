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
  pwaIconPath,
} from "@/constants/pwa";

// Served at /manifest.webmanifest. Linked from the root layout.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: PWA_ID,
    name: PWA_NAME,
    short_name: PWA_SHORT_NAME,
    description: PWA_DESCRIPTION,
    start_url: PWA_START_URL,
    scope: PWA_SCOPE,
    // No browser chrome once installed — this is meant to feel like an app.
    display: "standalone",
    // ~95% of use is on phones held upright (CLAUDE.md), and every screen is
    // a single mobile-first column, so there is nothing to gain from landscape.
    orientation: "portrait",
    // Read off the configured default language rather than pinned to "ar"/"rtl",
    // so flipping DEFAULT_LANGUAGE re-points the install too (CLAUDE.md rule 14).
    lang: DEFAULT_LANGUAGE,
    dir: getTextDirection(DEFAULT_LANGUAGE),
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      ...PWA_MANIFEST_ICON_SIZES.map((size) => ({
        src: pwaIconPath(size),
        sizes: `${size}x${size}`,
        type: "image/png",
        // "any": drawn as-is. Android also needs the maskable variant below,
        // or it pads the full-bleed icon into a small square on a white chip.
        purpose: "any" as const,
      })),
      {
        src: PWA_MASKABLE_ICON_PATH,
        sizes: `${PWA_MASKABLE_ICON_SIZE}x${PWA_MASKABLE_ICON_SIZE}`,
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
