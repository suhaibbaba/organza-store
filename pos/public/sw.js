// Caches the app shell and static assets only; never business data (the API is cross-origin and left alone).

const params = new URL(self.location.href).searchParams;

// New on every deploy (NEXT_PUBLIC_BUILD_ID): a new script URL is what installs the new worker.
const VERSION = params.get("v") || "dev";

const OFFLINE_URLS = (params.get("offline") || "").split(",").filter(Boolean);

// Only used offline; online, proxy.ts reads the same cookie.
const LOCALE_COOKIE_NAME = params.get("localeCookie") || "";

const CACHE_PREFIX = "store-pos";
// Versioned, so no one opens HTML from a build that no longer exists.
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`;
// Not versioned: Next content-hashes these, so unchanged chunks are not re-downloaded on every deploy.
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const MAX_ASSET_ENTRIES = 200;

// Includes the no-photo placeholder, the one image needed exactly when the network has failed.
const PUBLIC_ASSET_PATTERN =
  /^\/(app_icon\/[\w-]+\/(favicon\.ico|icon-[\w-]+\.png)|product-placeholder\.svg|manifest\.webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Settled: one unreachable page must not fail the whole install.
      await Promise.allSettled(
        OFFLINE_URLS.map(async (url) => {
          const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
          if (isStorable(response)) {
            await cache.put(url, response);
          }
        }),
      );
      // No skipWaiting(): the app says when (service-worker-registrar.tsx); the POS waits until no sale is open.
    })(),
  );
});

// Sent by the app when it takes the update up; the string duplicates SERVICE_WORKER_SKIP_WAITING_MESSAGE (this file is not bundled).
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
        names.filter((name) => name !== SHELL_CACHE && name !== ASSET_CACHE).map((name) => caches.delete(name)),
      );
      await trimCache(ASSET_CACHE, MAX_ASSET_ENTRIES);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // The API is another origin: it always goes to the network, uncached.
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (url.searchParams.has("_rsc")) {
    return;
  }
  // next/image proxies product photos from the API. Same rule as the API.
  if (url.pathname.startsWith("/_next/image")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (PUBLIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Network-first; the cache is the safety net for a dead or crawling connection.
async function handleNavigation(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    // Returned as-is even when not 200: a sign-in redirect arrives as an opaque redirect only the browser can follow.
    if (isStorable(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)));
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: SHELL_CACHE });
    if (cached) {
      return cached;
    }

    const offline = await matchOfflinePage(request);
    if (offline) {
      return offline;
    }

    throw new Error("Offline and nothing cached for this navigation");
  }
}

/** Immutable assets: cache wins, network only fills the gap. */
async function cacheFirst(event) {
  const request = event.request;
  const cached = await caches.match(request, { cacheName: ASSET_CACHE });
  if (cached) {
    return cached;
  }

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
  if (response) {
    return response;
  }
  throw new Error("Offline and no cached copy of this asset");
}

/** The offline page for the locale the user was heading to, if we have it. */
async function matchOfflinePage(request) {
  const localeMatch = new URL(request.url).pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  // Offline launches from "/" use the stored language, so a cashier who chose Arabic still gets Arabic.
  const locale = localeMatch ? localeMatch[1] : await storedLocale();
  const forLocale = locale && OFFLINE_URLS.find((url) => url.startsWith(`/${locale}/`));
  const url = forLocale || OFFLINE_URLS[0];
  if (!url) {
    return undefined;
  }
  return caches.match(url, { cacheName: SHELL_CACHE });
}

// Cookie Store API is Chromium-only; elsewhere this returns nothing and the default language is used.
async function storedLocale() {
  if (!LOCALE_COOKIE_NAME || !self.cookieStore) {
    return undefined;
  }
  try {
    const cookie = await self.cookieStore.get(LOCALE_COOKIE_NAME);
    return cookie ? cookie.value : undefined;
  } catch {
    return undefined;
  }
}

// Opaque and redirected responses can never be replayed for a navigation.
function isStorable(response) {
  return Boolean(response) && response.ok && response.type === "basic" && !response.redirected;
}

/** cache.keys() is insertion-ordered, so the front of the list is the oldest. */
async function trimCache(cacheName, maxEntries) {
  if (!(await caches.has(cacheName))) {
    return;
  }
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) {
    return;
  }
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
