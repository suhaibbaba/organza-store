// Install identity for the POS PWA.
//
// The POS and the admin are installed side by side on the same phone, so
// every value here is deliberately *not* shared with the admin: same-looking
// names or icons would leave staff guessing which home-screen tile is which.
// The admin keeps its own copy of this file.

/** Brand teal (#235C63) — the logo's dark hue, and the colour of the POS mark itself. */
export const PWA_THEME_COLOR = "#235C63";
/**
 * Splash-screen backdrop. Brand mint (#B5D3CB), matching the POS icon's own
 * background, so launching reads as one continuous surface — and tells the
 * light POS tile apart from the dark admin one at a glance.
 */
export const PWA_BACKGROUND_COLOR = "#B5D3CB";

export const PWA_NAME = "Organza POS";
export const PWA_SHORT_NAME = "POS";
export const PWA_DESCRIPTION = "Organza Store point of sale";

// Not a locale-prefixed path: launching from the home screen lands on "/",
// and proxy.ts + next-intl resolve whichever language the user last chose.
// Hard-coding "/ar" here would drag an English- or Hebrew-speaking employee
// back to Arabic on every launch.
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
// Pinned so a future change to start_url doesn't read as a *different* app,
// which would orphan the tile already on everyone's home screen.
export const PWA_ID = "/";

export const PWA_MANIFEST_PATH = "/manifest.webmanifest";

/** Square PNGs in public/, used for the manifest and the browser's favicon set. */
export const PWA_ICON_SIZES = [16, 32, 48, 64, 128, 192, 256, 512] as const;
/** iOS home-screen icon. Fixed at 180 — iOS ignores the manifest icons entirely. */
export const PWA_APPLE_ICON_SIZE = 180;
/** Android adaptive icon: the logo sits inside the safe zone so a circular mask can't clip it. */
export const PWA_MASKABLE_ICON_SIZE = 512;

export const pwaIconPath = (size: number): string => `/icon-${size}.png`;
export const PWA_MASKABLE_ICON_PATH = `/icon-maskable-${PWA_MASKABLE_ICON_SIZE}.png`;
export const PWA_FAVICON_PATH = "/favicon.ico";

/** Service worker — see public/sw.js. */
export const SERVICE_WORKER_PATH = "/sw.js";
/** Query params the worker reads off its own script URL (it can't import app code). */
export const SERVICE_WORKER_VERSION_PARAM = "v";
export const SERVICE_WORKER_OFFLINE_PARAM = "offline";

/**
 * Offline fallback route. Public (see proxy.ts) because the worker precaches
 * it, and a precached redirect-to-login would be useless as a fallback.
 */
export const OFFLINE_PATH = "/offline";
