/*
 * Organza Admin — service worker.
 *
 * Three jobs, and only three:
 *   1. Make the installed app open instantly and survive a weak connection,
 *      by caching the app shell (the HTML skeleton) and the build's static
 *      assets.
 *   2. Never, ever serve stale business data. Products, stock and orders all
 *      come from the backend API on a different origin, and this worker
 *      declines to touch anything cross-origin. A cached stock figure would
 *      mean selling something the shop no longer has.
 *   3. Draw the sale notifications the backend pushes (see the push handler
 *      at the bottom), and open the order they are about when tapped.
 *
 * The cached HTML is safe to keep because every screen is a client component
 * that fetches its data at runtime (see e.g. dashboard/page.tsx) — the
 * server-rendered document is an empty skeleton, with no user or shop data in
 * it. That is also why the no-store header Next puts on those documents is
 * deliberately not honoured here.
 *
 * This file is NOT bundled — it runs in the service-worker global scope and
 * cannot import from src/. Anything it needs to know about the app is passed
 * on its own script URL by components/pwa/service-worker-registrar.tsx.
 */

const params = new URL(self.location.href).searchParams;

// Changes on every deploy (NEXT_PUBLIC_BUILD_ID, see next.config.ts). A new
// value means a new script URL, which is what makes the browser install this
// worker instead of leaving phones running the previous one.
const VERSION = params.get("v") || "dev";

// Locale-prefixed offline pages, passed in so the locale list stays in
// shared/ and isn't duplicated here. First entry is the default locale.
const OFFLINE_URLS = (params.get("offline") || "").split(",").filter(Boolean);

// Where the notification wording lives, per language (see
// src/app/api/push-messages/[locale]/route.ts). Passed in for the same
// reason as the offline pages: this file knows no app routes of its own.
const PUSH_MESSAGES_BASE_PATH = params.get("messages") || "";

const CACHE_PREFIX = "organza-admin";
// Versioned: every deploy starts with an empty shell cache, so nobody is left
// opening an HTML document from a build that no longer exists.
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`;
// Not versioned: everything in here is content-hashed by Next, so the URL
// already changes when the file does. Re-downloading unchanged chunks on
// every deploy would waste the shop's mobile data for nothing.
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const MAX_ASSET_ENTRIES = 200;

// Files served straight out of public/ — icons and the manifest.
const PUBLIC_ASSET_PATTERN = /^\/(favicon\.ico|icon-[\w-]+\.png|manifest\.webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Settled, not all: one unreachable page must not fail the whole
      // install and leave the app with no worker at all.
      await Promise.allSettled(
        OFFLINE_URLS.map(async (url) => {
          const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
          if (isStorable(response)) {
            await cache.put(url, response);
          }
        })
      );
      // Deliberately NOT skipWaiting() here: taking over silently swaps the
      // build underneath a page that is already running the old one. This
      // worker waits, the app notices it waiting and offers the update
      // (components/pwa/update-prompt.tsx), and the message below is how the
      // user's "update now" tap gets here. Staff leave the app open for days,
      // so without that prompt they simply stay on yesterday's build.
    })()
  );
});

// The one thing this worker is told to do from the page: stop waiting and
// become the active worker, which fires `controllerchange` there and lets the
// page reload onto the new build. The string is duplicated from
// constants/pwa.ts (SERVICE_WORKER_SKIP_WAITING_MESSAGE) — this file isn't
// bundled and can't import it.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== ASSET_CACHE)
          .map((name) => caches.delete(name))
      );
      await trimCache(ASSET_CACHE, MAX_ASSET_ENTRIES);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // The backend API is a different origin (NEXT_PUBLIC_API_URL): letting it
  // fall through to the network, uncached, is the whole point.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // React Server Component payloads — the data path for client-side
  // navigation. Always fresh.
  if (url.searchParams.has("_rsc")) return;
  // next/image proxies product photos from the API. Same rule as the API.
  if (url.pathname.startsWith("/_next/image")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Content-hashed by the build (JS, CSS, and the self-hosted fonts under
  // /_next/static/media) — if the URL matches, the bytes match.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (PUBLIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

/**
 * Network-first: the shop is normally online, and a fresh document is always
 * preferable. The cache is the safety net for a dead or crawling connection.
 */
async function handleNavigation(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    // A successful fetch is returned as-is even when it isn't a 200 — a
    // navigation redirect (proxy.ts sending a signed-out user to /login)
    // arrives here as an opaque redirect that only the browser can follow.
    if (isStorable(response)) {
      const copy = response.clone();
      event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
      );
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: SHELL_CACHE });
    if (cached) return cached;

    const offline = await matchOfflinePage(request);
    if (offline) return offline;

    throw new Error("Offline and nothing cached for this navigation");
  }
}

/** Immutable assets: cache wins, network only fills the gap. */
async function cacheFirst(event) {
  const request = event.request;
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) return cached;

  const response = await fetch(request);
  if (isStorable(response)) {
    const copy = response.clone();
    event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)));
  }
  return response;
}

/** Icons and the manifest: instant from cache, refreshed quietly behind it. */
async function staleWhileRevalidate(event) {
  const request = event.request;
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });

  const network = fetch(request)
    .then(async (response) => {
      if (isStorable(response)) {
        const cache = await caches.open(ASSET_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const response = await network;
  if (response) return response;
  throw new Error("Offline and no cached copy of this asset");
}

/** The offline page for the locale the user was heading to, if we have it. */
async function matchOfflinePage(request) {
  const localeMatch = new URL(request.url).pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  const forLocale = localeMatch && OFFLINE_URLS.find((url) => url.startsWith(`/${localeMatch[1]}/`));
  // Falls back to the first entry, which the registrar puts in the app's
  // default language.
  const url = forLocale || OFFLINE_URLS[0];
  if (!url) return undefined;
  return caches.match(url, { cacheName: SHELL_CACHE });
}

/**
 * `basic` rules out opaque cross-origin responses, and `redirected` matters
 * because a redirected response can never be replayed for a navigation —
 * the browser rejects it outright.
 */
function isStorable(response) {
  return Boolean(response) && response.ok && response.type === "basic" && !response.redirected;
}

/* ============================================================
 *  Sale notifications (Web Push)
 *
 *  The backend pushes DATA, never a sentence: translation keys, the item
 *  names in every language, the total, the currency and who sold it (see
 *  backend/src/lib/saleNotifications.ts). This is where that becomes a line
 *  of text — in the reader's own language, with the wording taken from the
 *  app's own translations (src/app/api/push-messages/[locale]/route.ts), so
 *  nothing user-facing is written into this file.
 * ============================================================ */

const SALE_PAYLOAD_TYPE = "sale";
const NOTIFICATION_ICON = "/icon-192.png";
const NOTIFICATION_BADGE = "/icon-64.png";

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event.data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (url) event.waitUntil(openApp(url));
});

async function handlePush(data) {
  let payload;
  try {
    payload = data ? data.json() : null;
  } catch {
    payload = null;
  }
  // Only this backend can push here (the subscription is bound to its VAPID
  // key), so anything unreadable is a version mismatch, not an attack —
  // there is nothing truthful to draw, so nothing is drawn.
  if (!payload || payload.type !== SALE_PAYLOAD_TYPE) return;

  const locale = payload.locale || payload.defaultLanguage;
  const messages = await loadPushMessages(locale);

  const values = {
    items: describeItems(payload, messages, locale),
    total: formatCurrency(payload.total, payload.currency, locale),
    staff: payload.staffName || "",
    orderNumber: payload.orderNumber,
  };

  const title = fill(messages[payload.titleKey], values);
  const body = fill(messages[payload.bodyKey], values);

  await self.registration.showNotification(title || `#${payload.orderNumber}`, {
    // Without wording (a deploy mid-flight, or a phone that lost the
    // connection between the push and this fetch) the notification still
    // says what happened, using only the sale's own data — an invented
    // English sentence would be worse than none.
    body: body || [values.items, values.total, values.staff].filter(Boolean).join(" — "),
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    lang: locale,
    dir: "auto",
    // One notification per order: a re-push replaces its predecessor rather
    // than stacking a second copy of the same sale.
    tag: `${SALE_PAYLOAD_TYPE}-${payload.orderId}`,
    data: { url: orderUrl(locale, payload.orderId) },
  });
}

/** Tapping a sale opens that sale — reusing an open tab when there is one. */
async function openApp(url) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if (new URL(client.url).origin === self.location.origin) {
      await client.focus();
      if ("navigate" in client) {
        await client.navigate(url).catch(() => undefined);
      }
      return;
    }
  }
  await self.clients.openWindow(url);
}

function orderUrl(locale, orderId) {
  return `/${locale}/orders/${orderId}`;
}

/**
 * The wording, in one language. Network first — a push only arrives on a
 * device that is online, so this is nearly always fresh — with the last copy
 * kept in the shell cache as the safety net.
 */
async function loadPushMessages(locale) {
  if (!PUSH_MESSAGES_BASE_PATH) return {};
  const url = `${PUSH_MESSAGES_BASE_PATH}/${locale}`;

  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (isStorable(response)) {
      const copy = response.clone();
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(url, copy);
      return await response.json();
    }
  } catch {
    // Fall through to whatever was cached last time.
  }

  const cached = await caches.match(url, { cacheName: SHELL_CACHE });
  if (!cached) return {};
  return cached.json().catch(() => ({}));
}

/**
 * "فستان سهرة، عباية" — plus "and N more" when the sale had more lines.
 *
 * The title/body keys arrive in the payload; how a list of items is joined is
 * this layer's own presentation choice, so those two keys are named here.
 * They mirror PUSH_MESSAGE_KEYS in shared/src/constants/push.ts — this file
 * isn't bundled and can't import them.
 */
function describeItems(payload, messages, locale) {
  const separator = messages["push.sale.itemSeparator"] || " ";
  const names = (payload.itemNames || []).map((name) => localize(name, locale, payload.defaultLanguage)).filter(Boolean);
  const listed = names.join(separator);

  if (!payload.extraItemCount) return listed;
  const more = fill(messages["push.sale.moreItems"], { count: payload.extraItemCount });
  return more ? `${listed}${separator}${more}` : listed;
}

/** Same fallback chain as the app's localize() (CLAUDE.md rule 9). */
function localize(value, locale, defaultLanguage) {
  if (!value || typeof value !== "object") return "";
  return value[locale] || value[defaultLanguage] || Object.values(value).find(Boolean) || "";
}

/** Currency comes from the shop's settings, never from a symbol written here. */
function formatCurrency(amount, currency, locale) {
  const value = Number(amount);
  if (!Number.isFinite(value) || !currency) return String(amount ?? "");
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Fills {placeholders} in a message with the sale's own figures. */
function fill(template, values) {
  if (typeof template !== "string") return "";
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

/** cache.keys() is insertion-ordered, so the front of the list is the oldest. */
async function trimCache(cacheName, maxEntries) {
  if (!(await caches.has(cacheName))) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
