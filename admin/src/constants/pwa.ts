// Not shared with the POS: both are installed on the same phone and must not look alike.

import { SANDBOX_NAME_SUFFIX, appIconBasePath } from "@store/shared/constants/appEnv";
import { APP_ENV, APP_NAME, IS_SANDBOX } from "@/lib/env";
import type { AppleSplashScreen } from "@/types";

/** Brand teal (#235C63) — the logo's dark hue, and the admin icon's background. */
export const PWA_THEME_COLOR = "#235C63";
// The one colour the whole launch is built on: Android's splash, public/splash/ and the boot splash.
export const PWA_BACKGROUND_COLOR = "#235C63";
export const PWA_SPLASH_FOREGROUND_COLOR = "#B5D3CB";

const PWA_BASE_NAME = APP_NAME;
const PWA_BASE_SHORT_NAME = "Admin";

// Not t(): the installed app's own name; "(SBX)" tells the two installs apart on the home screen.
export const PWA_NAME = IS_SANDBOX ? `${PWA_BASE_NAME} (${SANDBOX_NAME_SUFFIX})` : PWA_BASE_NAME;
export const PWA_SHORT_NAME = IS_SANDBOX ? `${PWA_BASE_SHORT_NAME} ${SANDBOX_NAME_SUFFIX}` : PWA_BASE_SHORT_NAME;
export const PWA_DESCRIPTION = "Store Management admin dashboard";

// "/" so proxy.ts picks this device's chosen language, never Accept-Language.
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
// Pinned so a start_url change doesn't orphan the installed tile.
export const PWA_ID = "/";

export const PWA_MANIFEST_PATH = "/manifest.webmanifest";

// Icon folder chosen at build time from NEXT_PUBLIC_APP_ENV: paths in <link> and the manifest are cached hard.

export const PWA_ICON_BASE_PATH = appIconBasePath(APP_ENV);

// 192 is the launcher, 512 Chrome's install prompt and splash; the rest are derived.
export const PWA_MANIFEST_ICON_SIZES = [192, 512] as const;
// A real 32px tab icon beside the 16px favicon.ico, which modern displays would upscale.
export const PWA_FAVICON_PNG_SIZES = [32] as const;
/** iOS home-screen icon. Fixed at 180 — iOS ignores the manifest icons entirely. */
export const PWA_APPLE_ICON_SIZE = 180;
/** Android adaptive icon: the logo sits inside the safe zone so a circular mask can't clip it. */
export const PWA_MASKABLE_ICON_SIZE = 512;
// Android scales it to ~96px; downscaling the 192 is sharper, and it is already fetched.
export const PWA_NOTIFICATION_ICON_SIZE = 192;

export const pwaIconPath = (size: number): string => `${PWA_ICON_BASE_PATH}/icon-${size}.png`;
export const PWA_MASKABLE_ICON_PATH = `${PWA_ICON_BASE_PATH}/icon-maskable-${PWA_MASKABLE_ICON_SIZE}.png`;
export const PWA_FAVICON_PATH = `${PWA_ICON_BASE_PATH}/favicon.ico`;

// iOS shows a launch image only on an exact device match, never scaled; name and query are derived from each entry.

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

// Portrait only; Safari honours the prefixed -webkit-device-pixel-ratio here.
export const appleSplashMediaQuery = ({ width, height, pixelRatio }: AppleSplashScreen): string =>
  `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`;

// The icon without its backing: a decoded flat fill lands one shade off the CSS backdrop and shows a seam.
export const BOOT_SPLASH_MARK_SIZE = 512;
export const BOOT_SPLASH_MARK_PATH = `${PWA_ICON_BASE_PATH}/icon-mark-${BOOT_SPLASH_MARK_SIZE}.png`;

/** The mark fading up and settling into place. */
export const BOOT_SPLASH_FADE_IN_MS = 260;

// A splash vanishing mid-entrance reads as a glitch.
export const BOOT_SPLASH_MIN_VISIBLE_MS = 380;

/** The fade out. The app underneath stops being covered the moment it starts. */
export const BOOT_SPLASH_FADE_OUT_MS = 220;

// After this the user gets the app's "couldn't reach the server" instead of a stuck splash.
export const BOOT_SPLASH_MAX_VISIBLE_MS = 3_000;

// When React never runs, the server-rendered splash has nobody to take it down; boot-failure.tsx says so.

// Times the app starting at all (not the session request); a false alarm tells a working phone it is broken.
export const BOOT_WATCHDOG_MS = 12_000;

// Parsed, never run: our build's oldest output (Safari 15); raise it with the browserslist floor.
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
export const SERVICE_WORKER_MESSAGES_PARAM = "messages";
// The worker can't read APP_ENV, so the environment's icon is passed in.
export const SERVICE_WORKER_NOTIFICATION_ICON_PARAM = "notificationIcon";
// Lets an offline launch from "/" use the chosen language.
export const SERVICE_WORKER_LOCALE_COOKIE_PARAM = "localeCookie";

// sw.js matches this exact string; it can't import this file.
export const SERVICE_WORKER_SKIP_WAITING_MESSAGE = "SKIP_WAITING";

// An interrupted install may never answer; a reload beats a dead button.
export const UPDATE_RELOAD_FALLBACK_MS = 3_000;

// The worker can't import next-intl, so this route serves it the same messages (rule 12).
export const PUSH_MESSAGES_BASE_PATH = "/api/push-messages";
export const pushMessagesPath = (locale: string): string => `${PUSH_MESSAGES_BASE_PATH}/${locale}`;

// changeRequests rides along so approval pushes name the field with the approvals screen's own labels.
export const PUSH_MESSAGES_NAMESPACES = ["push", "changeRequests"] as const;

/** Where a tapped notification lands: the order it is about. */
export const orderDetailPath = (locale: string, orderId: string): string => `/${locale}/orders/${orderId}`;

/** ...or, for an approval, the screen where it can be decided. */
export const changeRequestsPath = (locale: string): string => `/${locale}/change-requests`;

// serviceWorker.ready never resolves without a registered worker (every dev build), so the wait is bounded.
export const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

// Public (see proxy.ts): a precached redirect to login would be useless offline.
export const OFFLINE_PATH = "/offline";

// An installed app has no reload button or native pull-to-refresh, so it provides its own.

/** Finger travel before a downward drag counts as a pull rather than a scroll. */
export const PULL_REFRESH_DEAD_ZONE_PX = 8;
/** How much of the finger's travel the indicator actually follows. */
export const PULL_REFRESH_RESISTANCE = 0.5;
/** Pull this far and letting go refreshes. */
export const PULL_REFRESH_THRESHOLD_PX = 72;
/** The pull stops moving here, however hard it is pulled. */
export const PULL_REFRESH_MAX_PX = 112;
// Only the indicator moves; the page stays put.
export const PULL_REFRESH_INDICATOR_TRAVEL_RATIO = 0.5;
/** Minimum time the spinner stays up, so a fast refetch still reads as one. */
export const PULL_REFRESH_MIN_VISIBLE_MS = 400;
/** How far up the tree to look for something that handles its own touches. */
export const PULL_REFRESH_SURFACE_SEARCH_DEPTH = 12;
/** Opt out of the gesture on a subtree that needs the raw touches. */
export const PULL_REFRESH_IGNORE_ATTRIBUTE = "data-no-pull-refresh";

/** How long the "copied" tick stays up after the version line is tapped. */
export const COPIED_FEEDBACK_MS = 2_000;

/** The app icon size the sidebar logo falls back to before a shop logo is uploaded. */
export const LOGO_ICON_SIZE = 192;

// One fixed address per icon size: it redirects to the shop's uploaded favicon, else to this environment's built-in icon.
export const BRAND_ICON_ROUTE = "/brand-icon";
export const brandIconPath = (size: number): string => `${BRAND_ICON_ROUTE}/${size}.png`;
// Short, so a newly uploaded favicon reaches open tabs and installed apps within minutes.
export const BRAND_ICON_CACHE_SECONDS = 300;
export const BRANDING_API_PATH = "/api/branding";
