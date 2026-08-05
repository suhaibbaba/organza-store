// Install identity for the admin PWA.
//
// The admin and the POS are installed side by side on the same phone, so
// every value here is deliberately *not* shared with the POS: same-looking
// names or icons would leave staff guessing which home-screen tile is which.
// The POS keeps its own copy of this file.

/** Brand teal (#235C63) — the logo's dark hue, and the admin icon's background. */
export const PWA_THEME_COLOR = "#235C63";
/** Splash-screen backdrop. Teal, so the admin icon sits on its own background while launching. */
export const PWA_BACKGROUND_COLOR = "#235C63";

export const PWA_NAME = "Organza Admin";
export const PWA_SHORT_NAME = "Admin";
export const PWA_DESCRIPTION = "Organza Store admin dashboard";

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
export const SERVICE_WORKER_MESSAGES_PARAM = "messages";

/**
 * Where the worker reads the notification wording from, per language.
 *
 * A push notification is drawn by the service worker, which cannot import
 * next-intl — and the API deliberately sends translation keys rather than
 * sentences (CLAUDE.md rule 12). This route hands the worker the same
 * messages/*.json the rest of the app uses, so notification text lives in
 * exactly one place and is never hard-coded in sw.js.
 */
export const PUSH_MESSAGES_BASE_PATH = "/api/push-messages";
export const pushMessagesPath = (locale: string): string => `${PUSH_MESSAGES_BASE_PATH}/${locale}`;

/** The messages namespace that route exposes — the notification wording only. */
export const PUSH_MESSAGES_NAMESPACE = "push";

/** Where a tapped notification lands: the order it is about. */
export const orderDetailPath = (locale: string, orderId: string): string => `/${locale}/orders/${orderId}`;

/**
 * How long to wait for the service worker to take control before giving up
 * on switching notifications on. `navigator.serviceWorker.ready` never
 * rejects — it simply never resolves when no worker is registered (which is
 * every dev build, where registration is skipped) — so a bounded wait is the
 * difference between an error message and a button that spins forever.
 */
export const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

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
/** How much of the finger's travel the content actually follows. */
export const PULL_REFRESH_RESISTANCE = 0.5;
/** Pull this far and letting go refreshes. */
export const PULL_REFRESH_THRESHOLD_PX = 72;
/** The pull stops moving here, however hard it is pulled. */
export const PULL_REFRESH_MAX_PX = 112;
/** Minimum time the spinner stays up, so a fast refetch still reads as one. */
export const PULL_REFRESH_MIN_VISIBLE_MS = 400;
/** How far up the tree to look for something that handles its own touches. */
export const PULL_REFRESH_SURFACE_SEARCH_DEPTH = 12;
/** Opt out of the gesture on a subtree that needs the raw touches. */
export const PULL_REFRESH_IGNORE_ATTRIBUTE = "data-no-pull-refresh";
