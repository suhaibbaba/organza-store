/*
 * Organza Admin — service worker.
 *
 * Two jobs, and only two:
 *   1. Make the installed app open instantly and survive a weak connection,
 *      by caching the app shell (the HTML skeleton) and the build's static
 *      assets.
 *   2. Never, ever serve stale business data. Products, stock and orders all
 *      come from the backend API on a different origin, and this worker
 *      declines to touch anything cross-origin. A cached stock figure would
 *      mean selling something the shop no longer has.
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
      // Take over as soon as we're ready rather than waiting for every tab to
      // close — staff leave the app open for days.
      await self.skipWaiting();
    })()
  );
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

/** cache.keys() is insertion-ordered, so the front of the list is the oldest. */
async function trimCache(cacheName, maxEntries) {
  if (!(await caches.has(cacheName))) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
