"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { routing } from "@/i18n/routing";
import { LOCALE_COOKIE_NAME } from "@/constants/locale";
import {
  OFFLINE_PATH,
  PUSH_MESSAGES_BASE_PATH,
  SERVICE_WORKER_LOCALE_COOKIE_PARAM,
  SERVICE_WORKER_MESSAGES_PARAM,
  SERVICE_WORKER_OFFLINE_PARAM,
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SKIP_WAITING_MESSAGE,
  SERVICE_WORKER_VERSION_PARAM,
  UPDATE_RELOAD_FALLBACK_MS,
} from "@/constants/pwa";
import { UpdatePrompt } from "@/components/pwa/update-prompt";

/**
 * Registers public/sw.js, and offers the update when a newer build is ready.
 *
 * The build id rides along in the script URL, so a deploy changes the URL and
 * the browser downloads the new worker. That worker then *waits* rather than
 * taking over silently (see the install handler in public/sw.js), and this is
 * where the app notices it waiting and asks the user — one tap, which
 * activates the new build and reloads onto it.
 *
 * Waiting rather than swapping the build underneath a running page is the
 * cautious half; the prompt is the other half, and it is not optional. An
 * installed app has no address bar and no reload button, so a phone sitting on
 * a stale cached build has no way forward on its own — which is exactly the
 * failure this is here to end.
 */
export function ServiceWorkerRegistrar() {
  // The worker that has finished installing and is waiting its turn. Null
  // whenever the running build is the newest one there is.
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // One reload, ever: `controllerchange` can fire more than once, and a page
  // that reloads on each would loop.
  const hasReloaded = useRef(false);

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
      // Which cookie holds the chosen language, so an offline launch from
      // "/" can answer in it instead of always in the default.
      [SERVICE_WORKER_LOCALE_COOKIE_PARAM]: LOCALE_COOKIE_NAME,
      // Where to read notification wording from — the worker can't import
      // the app's translations, so it is told where they live.
      [SERVICE_WORKER_MESSAGES_PARAM]: PUSH_MESSAGES_BASE_PATH,
    });

    let registration: ServiceWorkerRegistration | undefined;
    // Whether this page was already under a worker's control when it loaded.
    // On a first-ever install the worker claims this page as it activates,
    // which is a controller change with nothing stale behind it — reloading
    // for that would be a pointless flash on someone's first visit.
    const hadController = Boolean(navigator.serviceWorker.controller);

    // A worker only counts as "an update" when something is already
    // controlling this page. On a first-ever install there is nothing stale to
    // escape from, and the worker taking over quietly is exactly right.
    const offerIfWaiting = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) setWaitingWorker(worker);
    };

    const watchInstalling = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") offerIfWaiting(worker);
      });
    };

    navigator.serviceWorker
      // updateViaCache "none": the browser must revalidate the worker script
      // itself rather than serve it from the HTTP cache.
      .register(`${SERVICE_WORKER_PATH}?${query.toString()}`, { scope: "/", updateViaCache: "none" })
      .then((result) => {
        registration = result;
        // Already waiting when this page loaded — the update was downloaded
        // during an earlier visit and never taken up.
        offerIfWaiting(result.waiting);
        if (result.installing) watchInstalling(result.installing);
        result.addEventListener("updatefound", () => {
          if (result.installing) watchInstalling(result.installing);
        });
      })
      // Offline, private mode, or an unsupported browser. The app works
      // without a worker — it just isn't installable — so never surface this.
      .catch(() => undefined);

    // The new worker has taken control: everything the page loads from here on
    // is the new build, so the page itself has to be reloaded to match.
    const onControllerChange = () => {
      if (!hadController || hasReloaded.current) return;
      hasReloaded.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // The app can stay open on a phone for days without a full page load, so
    // bringing it back to the foreground is the moment to look for a deploy.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    setIsUpdating(true);
    // The worker answers by calling skipWaiting(), which makes it the
    // controller and fires controllerchange above — that is what reloads the
    // page. The timeout is the safety net for a worker that never answers
    // (an install interrupted mid-flight): reloading anyway is still better
    // than a button that does nothing.
    waitingWorker.postMessage({ type: SERVICE_WORKER_SKIP_WAITING_MESSAGE });
    window.setTimeout(() => {
      if (!hasReloaded.current) {
        hasReloaded.current = true;
        window.location.reload();
      }
    }, UPDATE_RELOAD_FALLBACK_MS);
  }, [waitingWorker]);

  if (!waitingWorker) return null;
  return <UpdatePrompt onUpdate={applyUpdate} isUpdating={isUpdating} />;
}
