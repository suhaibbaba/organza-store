// Caches the app shell and static assets, never API data (a stale stock figure sells what's gone), and draws pushes.

const params = new URL(self.location.href).searchParams;

// A new build id means a new script URL, which is what installs the new worker.
const VERSION = params.get("v") || "dev";

// First entry is the default locale.
const OFFLINE_URLS = (params.get("offline") || "").split(",").filter(Boolean);

// Used only offline; online, proxy.ts reads the same cookie.
const LOCALE_COOKIE_NAME = params.get("localeCookie") || "";

const PUSH_MESSAGES_BASE_PATH = params.get("messages") || "";

const CACHE_PREFIX = "store-admin";
// Versioned, so nobody opens HTML from a build that no longer exists.
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${VERSION}`;
// Not versioned: Next content-hashes these, so re-downloading them each deploy would only waste mobile data.
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const MAX_ASSET_ENTRIES = 200;

// Icons, manifest and the no-photo placeholder, which must work when the network is what failed.
const PUBLIC_ASSET_PATTERN =
  /^\/(app_icon\/[\w-]+\/(favicon\.ico|icon-[\w-]+\.png)|product-placeholder\.svg|manifest\.webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Settled, not all: one unreachable page must not fail the whole install.
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

// The page's "update now" (SERVICE_WORKER_SKIP_WAITING_MESSAGE): take over so the page reloads onto the new build.
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

  // The API is cross-origin and must never be cached.
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

  // Content-hashed: same URL, same bytes.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (PUBLIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// Network-first; the cache is the safety net for a dead connection.
async function handleNavigation(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    // Returned as-is even when not a 200: a redirect to /login is opaque and only the browser can follow it.
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
  // An offline launch from "/" has no locale, so use the stored choice to stay in the cashier's language.
  const locale = localeMatch ? localeMatch[1] : await storedLocale();
  const forLocale = locale && OFFLINE_URLS.find((url) => url.startsWith(`/${locale}/`));
  const url = forLocale || OFFLINE_URLS[0];
  if (!url) {
    return undefined;
  }
  return caches.match(url, { cacheName: SHELL_CACHE });
}

// The Cookie Store API is Chromium-only; elsewhere this returns nothing and the default language is used.
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

// A redirected response can never be replayed for a navigation.
function isStorable(response) {
  return Boolean(response) && response.ok && response.type === "basic" && !response.redirected;
}

// Web Push: the backend sends data and keys, never sentences; wording comes from the app's own translations.

const SALE_PAYLOAD_TYPE = "sale";
// Mirrors PUSH_PAYLOAD_TYPES in shared/src/constants/push.ts (this file can't import).
const CHANGE_REQUEST_PAYLOAD_TYPE = "changeRequest";
// Per-environment launcher icon; undefined rather than "", which would resolve as a relative URL and fail.
const NOTIFICATION_ICON = params.get("notificationIcon") || undefined;
const NOTIFICATION_BADGE = NOTIFICATION_ICON;

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event.data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (url) {
    event.waitUntil(openApp(url));
  }
});

async function handlePush(data) {
  let payload;
  try {
    payload = data ? data.json() : null;
  } catch {
    payload = null;
  }
  // Only this backend can push here, so an unreadable or unknown payload is a version mismatch: draw nothing.
  if (!payload) {
    return;
  }

  const locale = payload.locale || payload.defaultLanguage;
  const messages = await loadPushMessages(locale);

  if (payload.type === CHANGE_REQUEST_PAYLOAD_TYPE) {
    await showChangeRequest(payload, messages, locale);
    return;
  }
  if (payload.type !== SALE_PAYLOAD_TYPE) {
    return;
  }

  const values = {
    items: describeItems(payload, messages, locale),
    total: formatCurrency(payload.total, payload.currency, locale),
    staff: payload.staffName || "",
    orderNumber: payload.orderNumber,
  };

  const title = fill(messages[payload.titleKey], values);
  const body = fill(messages[payload.bodyKey], values);

  await self.registration.showNotification(title || `#${payload.orderNumber}`, {
    // Without wording, still say what happened from the sale's own data rather than invent an English sentence.
    body: body || [values.items, values.total, values.staff].filter(Boolean).join(" — "),
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    lang: locale,
    dir: "auto",
    // One notification per order: a re-push replaces its predecessor.
    tag: `${SALE_PAYLOAD_TYPE}-${payload.orderId}`,
    data: { url: orderUrl(locale, payload.orderId) },
  });
}

// Wording comes from the app's translations; tapping opens the approvals screen.
async function showChangeRequest(payload, messages, locale) {
  const values = {
    staff: payload.staffName || "",
    field: changeFieldLabel(payload, messages),
    // An expense has no product; its category names it.
    item: localize(payload.productLabel || payload.entityLabel, locale, payload.defaultLanguage),
    count: payload.pendingCount || 0,
  };

  const title = fill(messages[payload.titleKey], values);
  const body = fill(messages[payload.bodyKey], values);

  await self.registration.showNotification(title || values.field, {
    body: body || [values.item, values.staff].filter(Boolean).join(" — "),
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    lang: locale,
    dir: "auto",
    // One notification per request: a superseding ask replaces its predecessor.
    tag: `${CHANGE_REQUEST_PAYLOAD_TYPE}-${payload.changeRequestId}`,
    data: { url: changeRequestsUrl(locale) },
  });
}

// Mirrors src/lib/change-requests.ts; an unknown pair falls back to the generic label, never a raw column name.
const CHANGE_FIELD_LABEL_KEYS = {
  "Product:basePrice": "changeRequests.fields.price",
  "Product:compareAtPrice": "changeRequests.fields.comparePrice",
  "Product:stock": "changeRequests.fields.stock",
  "Product:isActive": "changeRequests.fields.visibility",
  "Product:variantSet": "changeRequests.fields.variantSet",
  "Variant:priceOverride": "changeRequests.fields.variantPrice",
  "Variant:stock": "changeRequests.fields.variantStock",
  "ProductImage:deletion": "changeRequests.fields.photoDeletion",
  "Expense:approvalStatus": "changeRequests.fields.expense",
};

function changeFieldLabel(payload, messages) {
  const key = CHANGE_FIELD_LABEL_KEYS[`${payload.entityType}:${payload.field}`] || "changeRequests.fields.other";
  return messages[key] || "";
}

function changeRequestsUrl(locale) {
  return `/${locale}/change-requests`;
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

// Network first, with the last copy kept in the shell cache.
async function loadPushMessages(locale) {
  if (!PUSH_MESSAGES_BASE_PATH) {
    return {};
  }
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
  if (!cached) {
    return {};
  }
  return cached.json().catch(() => ({}));
}

// These two keys mirror PUSH_MESSAGE_KEYS in shared/src/constants/push.ts (this file can't import).
function describeItems(payload, messages, locale) {
  const separator = messages["push.sale.itemSeparator"] || " ";
  const names = (payload.itemNames || [])
    .map((name) => localize(name, locale, payload.defaultLanguage))
    .filter(Boolean);
  const listed = names.join(separator);

  if (!payload.extraItemCount) {
    return listed;
  }
  const more = fill(messages["push.sale.moreItems"], { count: payload.extraItemCount });
  return more ? `${listed}${separator}${more}` : listed;
}

/** Same fallback chain as the app's localize() (CLAUDE.md rule 9). */
function localize(value, locale, defaultLanguage) {
  if (!value || typeof value !== "object") {
    return "";
  }
  return value[locale] || value[defaultLanguage] || Object.values(value).find(Boolean) || "";
}

/** Currency comes from the shop's settings, never from a symbol written here. */
function formatCurrency(amount, currency, locale) {
  const value = Number(amount);
  if (!Number.isFinite(value) || !currency) {
    return String(amount ?? "");
  }
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Fills {placeholders} in a message with the sale's own figures. */
function fill(template, values) {
  if (typeof template !== "string") {
    return "";
  }
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
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
