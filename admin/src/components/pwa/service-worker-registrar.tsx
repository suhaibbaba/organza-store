"use client";

import { useEffect } from "react";
import { routing } from "@/i18n/routing";
import {
  OFFLINE_PATH,
  SERVICE_WORKER_OFFLINE_PARAM,
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_VERSION_PARAM,
} from "@/constants/pwa";

/**
 * Registers public/sw.js. Renders nothing.
 *
 * The build id rides along in the script URL, so a deploy changes the URL and
 * the browser installs the new worker instead of keeping the old one — this
 * is what stops phones getting stuck on a previous version. The worker then
 * reads the same id back off its own URL to name its caches.
 *
 * There is deliberately no "an update is available, tap to reload" prompt:
 * the people using this aren't tech-savvy (CLAUDE.md), and a reload offered
 * mid-order is a good way to lose an order. The new worker takes over
 * quietly, and the next page load is already on the new build.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Dev serves uncompiled, constantly-changing chunks; caching those just
    // fights hot reload.
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Default locale first: the worker uses OFFLINE_URLS[0] when it can't
    // tell which language a failed navigation was headed for.
    const locales = [
      routing.defaultLocale,
      ...routing.locales.filter((locale) => locale !== routing.defaultLocale),
    ];

    const query = new URLSearchParams({
      [SERVICE_WORKER_VERSION_PARAM]: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
      [SERVICE_WORKER_OFFLINE_PARAM]: locales.map((locale) => `/${locale}${OFFLINE_PATH}`).join(","),
    });

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      // updateViaCache "none": the browser must revalidate the worker script
      // itself rather than serve it from the HTTP cache.
      .register(`${SERVICE_WORKER_PATH}?${query.toString()}`, { scope: "/", updateViaCache: "none" })
      .then((result) => {
        registration = result;
      })
      // Offline, private mode, or an unsupported browser. The app works
      // without a worker — it just isn't installable — so never surface this.
      .catch(() => undefined);

    // The app can stay open on a phone for days without a full page load, so
    // bringing it back to the foreground is the moment to look for a deploy.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => document.removeEventListener("visibilitychange", checkForUpdate);
  }, []);

  return null;
}
