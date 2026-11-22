// Deliberately not shared with the admin: both are installed side by side and must be told apart.

import { SANDBOX_NAME_SUFFIX, appIconBasePath } from "@store/shared/constants/appEnv";
import { APP_ENV, APP_NAME, IS_SANDBOX } from "@/lib/env";
import type { AppleSplashScreen } from "@/types";

/** Brand teal (#235C63) — the logo's dark hue, and the colour of the POS mark itself. */
export const PWA_THEME_COLOR = "#235C63";
// Mint, matching the POS icon: one colour for the whole launch, and the light tile vs the dark admin one.
export const PWA_BACKGROUND_COLOR = "#B5D3CB";
export const PWA_SPLASH_FOREGROUND_COLOR = "#235C63";

const PWA_BASE_NAME = APP_NAME;
const PWA_BASE_SHORT_NAME = "POS";

// The sandbox and live apps sit on the same phone, so the label differs as the icons do.
export const PWA_NAME = IS_SANDBOX ? `${PWA_BASE_NAME} (${SANDBOX_NAME_SUFFIX})` : PWA_BASE_NAME;
export const PWA_SHORT_NAME = IS_SANDBOX ? `${PWA_BASE_SHORT_NAME} ${SANDBOX_NAME_SUFFIX}` : PWA_BASE_SHORT_NAME;
export const PWA_DESCRIPTION = "Store Management point of sale";

// "/" not "/ar": proxy.ts resolves the device's last language, so nobody is dragged back to Arabic.
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
// Pinned so a start_url change doesn't orphan the tile already on everyone's home screen.
export const PWA_ID = "/";

export const PWA_MANIFEST_PATH = "/manifest.webmanifest";

// Icons: the folder (production/sandbox) is chosen once from NEXT_PUBLIC_APP_ENV.

export const PWA_ICON_BASE_PATH = appIconBasePath(APP_ENV);

// 192 is the launcher icon, 512 the install prompt and splash.
export const PWA_MANIFEST_ICON_SIZES = [192, 512] as const;
// Tab only; a real 32px PNG beside favicon.ico, since every current screen draws the tab at 32 physical pixels.
export const PWA_FAVICON_PNG_SIZES = [32] as const;
/** iOS home-screen icon. Fixed at 180 — iOS ignores the manifest icons entirely. */
export const PWA_APPLE_ICON_SIZE = 180;
/** Android adaptive icon: the logo sits inside the safe zone so a circular mask can't clip it. */
export const PWA_MASKABLE_ICON_SIZE = 512;

export const pwaIconPath = (size: number): string => `${PWA_ICON_BASE_PATH}/icon-${size}.png`;
export const PWA_MASKABLE_ICON_PATH = `${PWA_ICON_BASE_PATH}/icon-maskable-${PWA_MASKABLE_ICON_SIZE}.png`;
export const PWA_FAVICON_PATH = `${PWA_ICON_BASE_PATH}/favicon.ico`;

// iOS launch images: iOS draws nothing unless a startup image matches the exact device.

export const APPLE_SPLASH_SCREENS: readonly AppleSplashScreen[] = [
  { width: 375, height: 667, pixelRatio: 2 }, // iPhone SE (2nd/3rd gen), 6/6s/7/8
  { width: 414, height: 736, pixelRatio: 3 }, // iPhone 8 Plus
  { width: 375, height: 812, pixelRatio: 3 }, // iPhone X, XS, 11 Pro
  { width: 414, height: 896, pixelRatio: 2 }, // iPhone XR, 11
  { width: 390, height: 844, pixelRatio: 3 }, // iPhone 12, 12 Pro, 13, 13 Pro, 14
  { width: 393, height: 852, pixelRatio: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, pixelRatio: 3 }, // iPhone 12/13/14 Pro Max
  { width: 430, height: 932, pixelRatio: 3 }, // iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { width: 810, height: 1080, pixelRatio: 2 }, // iPad 10.2"
] as const;

/** public/splash/splash-<pixel width>x<pixel height>.png — never typed by hand. */
export const appleSplashImagePath = ({ width, height, pixelRatio }: AppleSplashScreen): string =>
  `/splash/splash-${width * pixelRatio}x${height * pixelRatio}.png`;

// Portrait only, and the prefixed pixel-ratio query because that is the one Safari honours.
export const appleSplashMediaQuery = ({ width, height, pixelRatio }: AppleSplashScreen): string =>
  `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`;

// Boot splash: the in-app half of the launch, between the launch image and the first screen.

export const BOOT_SPLASH_MARK_SIZE = 512;
export const BOOT_SPLASH_MARK_PATH = `${PWA_ICON_BASE_PATH}/icon-mark-${BOOT_SPLASH_MARK_SIZE}.png`;

/** The mark fading up and settling into place. */
export const BOOT_SPLASH_FADE_IN_MS = 260;

// A splash vanishing mid-fade reads as a glitch.
export const BOOT_SPLASH_MIN_VISIBLE_MS = 380;

/** The fade out. The app underneath stops being covered the moment it starts. */
export const BOOT_SPLASH_FADE_OUT_MS = 220;

// A hanging session request must not trap the user on a branded screen.
export const BOOT_SPLASH_MAX_VISIBLE_MS = 3_000;

// When the app never starts, the server-rendered splash has nobody to take it down; a watchdog does.

// Times the app starting at all over mobile data on a cold cache, not the session request.
export const BOOT_WATCHDOG_MS = 12_000;

// The oldest syntax our build may emit (Safari 15 floor): if it fails, the browser is too old.
export const BOOT_SUPPORT_PROBE = "class P{static #n=0;#i;constructor(){this.#i=P.#n++}}";

/** The small row of dots under the mark. */
export const BOOT_SPLASH_DOT_COUNT = 3;
/** One dot's full dim-bright-dim cycle. */
export const BOOT_SPLASH_DOT_PULSE_MS = 1_200;
/** Offset between neighbouring dots, so the row ripples instead of blinking. */
export const BOOT_SPLASH_DOT_STAGGER_MS = 160;

/** Service worker — see public/sw.js. */
export const SERVICE_WORKER_PATH = "/sw.js";
/** Query params the worker reads off its own script URL (it can't import app code). */
export const SERVICE_WORKER_VERSION_PARAM = "v";
export const SERVICE_WORKER_OFFLINE_PARAM = "offline";
// Lets an offline launch from "/" use the language an online one would have.
export const SERVICE_WORKER_LOCALE_COOKIE_PARAM = "localeCookie";

// public/sw.js matches this exact string; it isn't bundled and can't import it.
export const SERVICE_WORKER_SKIP_WAITING_MESSAGE = "SKIP_WAITING";

// An interrupted install may never answer; reloading beats a button that does nothing.
export const UPDATE_RELOAD_FALLBACK_MS = 3_000;

// The strip gives up on a download that stalls (the clinic waits the same).
export const UPDATE_GIVE_UP_MS = 30_000;

// Public because the worker precaches it; a precached login redirect would be useless.
export const OFFLINE_PATH = "/offline";

// Pull to refresh: an installed app has no reload button, so the app provides the gesture.

/** Finger travel before a downward drag counts as a pull rather than a scroll. */
export const PULL_REFRESH_DEAD_ZONE_PX = 8;
/** How much of the finger's travel the indicator actually follows. */
export const PULL_REFRESH_RESISTANCE = 0.5;
/** Pull this far and letting go refreshes. */
export const PULL_REFRESH_THRESHOLD_PX = 72;
/** The pull stops moving here, however hard it is pulled. */
export const PULL_REFRESH_MAX_PX = 112;
// Only the indicator moves; it tracks the finger within the strip under the top bar.
export const PULL_REFRESH_INDICATOR_TRAVEL_RATIO = 0.5;
/** Minimum time the spinner stays up, so a fast refetch still reads as one. */
export const PULL_REFRESH_MIN_VISIBLE_MS = 400;
/** How far up the tree to look for something that handles its own touches. */
export const PULL_REFRESH_SURFACE_SEARCH_DEPTH = 12;
/** Opt out of the gesture on a subtree that needs the raw touches. */
export const PULL_REFRESH_IGNORE_ATTRIBUTE = "data-no-pull-refresh";

/** How long the "copied" tick stays up after the version line is tapped. */
export const COPIED_FEEDBACK_MS = 2_000;

/** The icon size the top bar's logo is cut from (drawn at 36px). */
export const LOGO_ICON_SIZE = 192;

// One fixed address per icon size: it redirects to the shop's uploaded favicon, else to this environment's built-in icon.
export const BRAND_ICON_ROUTE = "/brand-icon";
export const brandIconPath = (size: number): string => `${BRAND_ICON_ROUTE}/${size}.png`;
// Short, so a newly uploaded favicon reaches open tabs and installed apps within minutes.
export const BRAND_ICON_CACHE_SECONDS = 300;
export const BRANDING_API_PATH = "/api/branding";
