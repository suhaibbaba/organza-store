// Install identity for the POS PWA.
//
// The POS and the admin are installed side by side on the same phone, so
// every value here is deliberately *not* shared with the admin: same-looking
// names or icons would leave staff guessing which home-screen tile is which.
// The admin keeps its own copy of this file.

import { SANDBOX_NAME_SUFFIX, appIconBasePath } from "@organza/shared/constants/appEnv";
import { APP_ENV, IS_SANDBOX } from "@/lib/env";
import type { AppleSplashScreen } from "@/types";

/** Brand teal (#235C63) — the logo's dark hue, and the colour of the POS mark itself. */
export const PWA_THEME_COLOR = "#235C63";
/**
 * Splash-screen backdrop. Brand mint (#B5D3CB), matching the POS icon's own
 * background, so launching reads as one continuous surface — and tells the
 * light POS tile apart from the dark admin one at a glance. This is the
 * single colour the whole launch sequence is built on: it is what Android
 * paints behind its generated splash, what the images in public/splash/ are
 * filled with, and what the in-app boot splash draws — so nothing changes
 * shade between the tap and the first screen.
 */
export const PWA_BACKGROUND_COLOR = "#B5D3CB";
/**
 * Brand teal (#235C63) — the colour the mark itself is drawn in on the mint
 * splash. The boot splash uses it so the in-app screen is made of the same
 * two colours as the image it takes over from.
 */
export const PWA_SPLASH_FOREGROUND_COLOR = "#235C63";

const PWA_BASE_NAME = "Organza POS";
const PWA_BASE_SHORT_NAME = "POS";

/*
 * The sandbox and the live shop are installed on the same phone, by the same
 * people, from the same two apps. The icons already differ (an amber SBX band
 * — see PWA_ICON_BASE_PATH below), and the label under the tile has to differ
 * with them, or the home screen shows two tiles called "POS" and the only
 * way to tell which is which is to open one and start typing into it.
 *
 * Not a t() string, deliberately: this is the app's own name — the identity
 * the operating system files the install under, chosen once at build time and
 * the same in every language, exactly like PWA_BASE_NAME above it. CLAUDE.md
 * rule 12 is about text shown to staff inside the app; the SANDBOX chip that
 * does that job goes through t() (components/layout/environment-badge.tsx).
 */
export const PWA_NAME = IS_SANDBOX ? `${PWA_BASE_NAME} (${SANDBOX_NAME_SUFFIX})` : PWA_BASE_NAME;
export const PWA_SHORT_NAME = IS_SANDBOX
  ? `${PWA_BASE_SHORT_NAME} ${SANDBOX_NAME_SUFFIX}`
  : PWA_BASE_SHORT_NAME;
export const PWA_DESCRIPTION = "Organza Store point of sale";

// Not a locale-prefixed path: launching from the home screen lands on "/",
// and proxy.ts resolves it against the language this device last chose —
// falling back to the shop's default, never to the phone's `Accept-Language`
// (see i18n/routing.ts). Hard-coding "/ar" here would drag an English- or
// Hebrew-speaking employee back to Arabic on every launch; leaving the
// resolution to the browser is what used to drag everyone else to English.
export const PWA_START_URL = "/";
export const PWA_SCOPE = "/";
// Pinned so a future change to start_url doesn't read as a *different* app,
// which would orphan the tile already on everyone's home screen.
export const PWA_ID = "/";

export const PWA_MANIFEST_PATH = "/manifest.webmanifest";

/* ---------------------------------------------------------------------------
 * Icons
 *
 * public/app_icon/production/ and public/app_icon/sandbox/ hold the same file
 * names; which folder every path below points at is decided here, once, from
 * NEXT_PUBLIC_APP_ENV (lib/env.ts). The sandbox artwork carries an amber SBX
 * band, so a phone with both installed shows two tiles that cannot be
 * confused — which is the whole point, since one of them writes to the shop's
 * real orders.
 *
 * Resolved at build time rather than served from a route: these paths end up
 * in <link> tags and in the manifest, both of which the browser and the
 * service worker cache aggressively, and a path that could change per request
 * is a path that gets cached wrong once and stays wrong.
 * ------------------------------------------------------------------------ */

export const PWA_ICON_BASE_PATH = appIconBasePath(APP_ENV);

/**
 * What Android installs from (the manifest's `icons`). 192 is the launcher
 * icon, 512 is what Chrome's install prompt and its generated splash use;
 * anything in between it derives itself. The maskable 512 below rides along
 * with them.
 */
export const PWA_MANIFEST_ICON_SIZES = [192, 512] as const;
/**
 * The browser tab, and nothing else.
 *
 * favicon.ico is a single 16×16 image, which is exactly one device pixel per
 * CSS pixel on a display nobody has any more: every current phone and laptop
 * draws that tab at 32 physical pixels and would be upscaling a 16. So a real
 * 32 is declared alongside it and wins wherever PNG favicons are understood,
 * with the .ico left in for the browsers and bookmark exports that still ask
 * for it by name. (Derived from icon-512.png — see the app's README.)
 */
export const PWA_FAVICON_PNG_SIZES = [32] as const;
/** iOS home-screen icon. Fixed at 180 — iOS ignores the manifest icons entirely. */
export const PWA_APPLE_ICON_SIZE = 180;
/** Android adaptive icon: the logo sits inside the safe zone so a circular mask can't clip it. */
export const PWA_MASKABLE_ICON_SIZE = 512;

export const pwaIconPath = (size: number): string => `${PWA_ICON_BASE_PATH}/icon-${size}.png`;
export const PWA_MASKABLE_ICON_PATH = `${PWA_ICON_BASE_PATH}/icon-maskable-${PWA_MASKABLE_ICON_SIZE}.png`;
export const PWA_FAVICON_PATH = `${PWA_ICON_BASE_PATH}/favicon.ico`;

/* ---------------------------------------------------------------------------
 * iOS launch images (see the root layout's `appleWebApp.startupImage`)
 *
 * Android needs nothing here: Chrome draws its own splash from the manifest's
 * name, icon and background_color. iOS draws nothing at all unless a
 * <link rel="apple-touch-startup-image"> matches the device *exactly* — it
 * never scales one image to fit another screen — and an installed app with no
 * match launches on a blank screen. This table is what removes that blank.
 *
 * Each entry is one device. The file name and the media query are both
 * derived from it, so a size can never be listed with the wrong query, and
 * adding a device means adding one line plus the matching PNG.
 * ------------------------------------------------------------------------ */

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

/**
 * The query iOS matches the image against.
 *
 * `orientation: portrait` is what stops a phone launched on its side from
 * being handed a portrait image: every file here is portrait, and the
 * manifest asks for a portrait app. -webkit-device-pixel-ratio is the
 * prefixed form on purpose — it is the one Safari honours here.
 */
export const appleSplashMediaQuery = ({ width, height, pixelRatio }: AppleSplashScreen): string =>
  `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`;

/* ---------------------------------------------------------------------------
 * Boot splash (see components/pwa/boot-splash.tsx)
 *
 * The images above are static — they are picture files the OS shows before
 * any of our code runs. This is the moving half: the same two colours, drawn
 * by the app itself, covering the gap between "the launch image went away"
 * and "the session check came back". Motion lives here because this is the
 * only part of the launch we actually control.
 * ------------------------------------------------------------------------ */

/**
 * The mark the boot splash draws: that environment's icon with its square
 * backing lifted off (app_icon/<env>/icon-mark-512.png, derived from
 * icon-512.png in the same folder — see the app's README).
 *
 * Per environment like everything else here, which means the sandbox's amber
 * SBX band is part of the mark and the launch screen says which stack is
 * opening before the first screen arrives.
 *
 * The square icon itself can't be used here. The splash paints its backdrop
 * in CSS, and the browser decodes and downscales the icon's flat fill to a
 * value one level off that colour — a one-level step across a large flat
 * field, which is exactly the artifact a plain launch screen shows off. With
 * no backing there is nothing to seam against, and the entrance scales the
 * mark itself rather than a tile that only looks invisible.
 *
 * Its location is deliberate: app_icon/ is what the service worker caches
 * (public/sw.js), so the launch screen still draws on a dead connection.
 */
export const BOOT_SPLASH_MARK_SIZE = 512;
export const BOOT_SPLASH_MARK_PATH = `${PWA_ICON_BASE_PATH}/icon-mark-${BOOT_SPLASH_MARK_SIZE}.png`;

/** The mark fading up and settling into place. */
export const BOOT_SPLASH_FADE_IN_MS = 260;

/**
 * Shortest time the screen stays up once it has appeared.
 *
 * A session that answers off a warm connection can come back in well under
 * the fade-in, and a splash that vanishes halfway through arriving reads as a
 * glitch rather than a launch. Long enough to finish the entrance, short
 * enough that nobody waits on it.
 */
export const BOOT_SPLASH_MIN_VISIBLE_MS = 380;

/** The fade out. The app underneath stops being covered the moment it starts. */
export const BOOT_SPLASH_FADE_OUT_MS = 220;

/**
 * The longest the screen may stay up, whatever the session check is doing.
 *
 * A phone on a dead connection can leave that request hanging for tens of
 * seconds, and a branded screen with no way past it is worse than the app's
 * own "couldn't reach the server" — which is what the user gets to instead
 * when this elapses.
 */
export const BOOT_SPLASH_MAX_VISIBLE_MS = 3_000;

/* ---------------------------------------------------------------------------
 * When the app does not start at all
 *
 * Everything above assumes React eventually runs. When it does not — the
 * bundle met syntax the phone cannot parse, a chunk never arrived — the boot
 * splash is server-rendered HTML with nobody left to take it down, so it stays
 * up forever and the app reads as merely slow. It is not slow, it is dead, and
 * the person holding the phone deserves to be told which.
 *
 * See components/pwa/boot-failure.tsx, which puts a plain message up instead.
 * ------------------------------------------------------------------------ */

/**
 * How long the splash may stand with no sign of React before the app is
 * declared dead.
 *
 * Well above BOOT_SPLASH_MAX_VISIBLE_MS, which is a different measurement —
 * that one times the *session request* on an app that is already running.
 * This one times the app getting off the ground at all, over shop mobile data
 * on a cold cache, and a false alarm here tells a working phone it is broken.
 * Twelve seconds is far longer than a slow start and far shorter than the
 * forever it replaces.
 */
export const BOOT_WATCHDOG_MS = 12_000;

/**
 * The syntax probe that decides *which* message goes up: whether this browser
 * is simply too old for the app, or whether something else went wrong.
 *
 * It is a sample of the oldest-permitted output of our own build — private and
 * static class fields, which is what the `browserslist` floor in package.json
 * (Safari 15 / iOS 15) allows the compiler to emit. A browser that cannot
 * compile this string cannot run the bundle either, whatever else may also be
 * wrong. Fed to `new Function`, which is a parse and not a run: nothing here
 * is executed.
 *
 * Raise the browserslist floor and this has to be raised with it, or the
 * failure screen goes back to blaming the network for an unsupported phone.
 */
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
/**
 * The locale cookie's name (constants/locale.ts), so a launch made offline
 * can fall back to the same language a launch made online would have. The
 * proxy is unreachable with no connection, and "/" carries no locale of its
 * own, so without this the worker would answer every offline start_url in
 * the default language regardless of what the user chose.
 */
export const SERVICE_WORKER_LOCALE_COOKIE_PARAM = "localeCookie";

/**
 * Posted to a waiting worker when the user taps "update now"
 * (components/pwa/update-prompt.tsx). The worker matches on this exact
 * string — public/sw.js isn't bundled and can't import this file.
 */
export const SERVICE_WORKER_SKIP_WAITING_MESSAGE = "SKIP_WAITING";

/**
 * How long to wait for a waiting worker to answer that message and take over
 * before reloading anyway. A worker whose install was interrupted mid-flight
 * may never answer, and a button that does nothing is worse than a reload
 * that lands on the same build.
 */
export const UPDATE_RELOAD_FALLBACK_MS = 3_000;

/**
 * Offline fallback route. Public (see proxy.ts) because the worker precaches
 * it, and a precached redirect-to-login would be useless as a fallback.
 */
export const OFFLINE_PATH = "/offline";

/* ---------------------------------------------------------------------------
 * Pull to refresh (see components/pwa/pull-to-refresh.tsx)
 *
 * Installed from the home screen there is no reload button and no native
 * pull-to-refresh, so the app provides the gesture itself. These are the
 * numbers that make it feel like the one the phone would have given you.
 * ------------------------------------------------------------------------ */

/** Finger travel before a downward drag counts as a pull rather than a scroll. */
export const PULL_REFRESH_DEAD_ZONE_PX = 8;
/** How much of the finger's travel the indicator actually follows. */
export const PULL_REFRESH_RESISTANCE = 0.5;
/** Pull this far and letting go refreshes. */
export const PULL_REFRESH_THRESHOLD_PX = 72;
/** The pull stops moving here, however hard it is pulled. */
export const PULL_REFRESH_MAX_PX = 112;
/**
 * How much of the pull the indicator itself travels. It is the only thing
 * that moves — the page underneath stays exactly where it is — so it has to
 * track the finger closely enough to feel attached to it, while staying
 * inside the strip of screen under the top bar.
 */
export const PULL_REFRESH_INDICATOR_TRAVEL_RATIO = 0.5;
/** Minimum time the spinner stays up, so a fast refetch still reads as one. */
export const PULL_REFRESH_MIN_VISIBLE_MS = 400;
/** How far up the tree to look for something that handles its own touches. */
export const PULL_REFRESH_SURFACE_SEARCH_DEPTH = 12;
/** Opt out of the gesture on a subtree that needs the raw touches. */
export const PULL_REFRESH_IGNORE_ATTRIBUTE = "data-no-pull-refresh";

/** How long the "copied" tick stays up after the version line is tapped. */
export const COPIED_FEEDBACK_MS = 2_000;
