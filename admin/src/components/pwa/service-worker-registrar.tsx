"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { routing } from "@/i18n/routing";
import { LOCALE_COOKIE_NAME } from "@/constants/locale";
import {
  OFFLINE_PATH,
  PUSH_MESSAGES_BASE_PATH,
  PWA_NOTIFICATION_ICON_SIZE,
  SERVICE_WORKER_LOCALE_COOKIE_PARAM,
  SERVICE_WORKER_MESSAGES_PARAM,
  SERVICE_WORKER_NOTIFICATION_ICON_PARAM,
  SERVICE_WORKER_OFFLINE_PARAM,
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SKIP_WAITING_MESSAGE,
  SERVICE_WORKER_VERSION_PARAM,
  UPDATE_RELOAD_FALLBACK_MS,
  brandIconPath,
} from "@/constants/pwa";
import { UpdatePrompt } from "@/components/pwa/update-prompt";

// A new worker waits and the app offers the update: an installed app has no reload button to escape a stale build.
export function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // One reload, ever: controllerchange can fire more than once.
  const hasReloaded = useRef(false);

  useEffect(() => {
    // Caching dev chunks would fight hot reload.
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Default locale first: the worker falls back to OFFLINE_URLS[0].
    const locales = [routing.defaultLocale, ...routing.locales.filter((locale) => locale !== routing.defaultLocale)];

    const query = new URLSearchParams({
      [SERVICE_WORKER_VERSION_PARAM]: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
      [SERVICE_WORKER_OFFLINE_PARAM]: locales.map((locale) => `/${locale}${OFFLINE_PATH}`).join(","),
      [SERVICE_WORKER_LOCALE_COOKIE_PARAM]: LOCALE_COOKIE_NAME,
      // The worker can't import the translations, so it is told where they live.
      [SERVICE_WORKER_MESSAGES_PARAM]: PUSH_MESSAGES_BASE_PATH,
      // The shop's icon (uploaded, else this environment's built-in one) — the worker cannot work it out itself.
      [SERVICE_WORKER_NOTIFICATION_ICON_PARAM]: brandIconPath(PWA_NOTIFICATION_ICON_SIZE),
    });

    let registration: ServiceWorkerRegistration | undefined;
    // On a first install the worker claims the page; reloading for that would be a pointless flash.
    const hadController = Boolean(navigator.serviceWorker.controller);

    // Only an update when something already controls this page.
    const offerIfWaiting = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) {
        setWaitingWorker(worker);
      }
    };

    const watchInstalling = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          offerIfWaiting(worker);
        }
      });
    };

    navigator.serviceWorker
      // The browser must revalidate the worker script, not serve it from the HTTP cache.
      .register(`${SERVICE_WORKER_PATH}?${query.toString()}`, { scope: "/", updateViaCache: "none" })
      .then((result) => {
        registration = result;
        // Downloaded during an earlier visit and never taken up.
        offerIfWaiting(result.waiting);
        if (result.installing) {
          watchInstalling(result.installing);
        }
        result.addEventListener("updatefound", () => {
          if (result.installing) {
            watchInstalling(result.installing);
          }
        });
      })
      // Offline, private mode or unsupported: the app still works, it just isn't installable.
      .catch(() => undefined);

    const onControllerChange = () => {
      if (!hadController || hasReloaded.current) {
        return;
      }
      hasReloaded.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // The app stays open for days, so returning to the foreground is when to look for a deploy.
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
    if (!waitingWorker) {
      return;
    }
    setIsUpdating(true);
    // skipWaiting fires controllerchange, which reloads; the timeout covers a worker that never answers.
    waitingWorker.postMessage({ type: SERVICE_WORKER_SKIP_WAITING_MESSAGE });
    window.setTimeout(() => {
      if (!hasReloaded.current) {
        hasReloaded.current = true;
        window.location.reload();
      }
    }, UPDATE_RELOAD_FALLBACK_MS);
  }, [waitingWorker]);

  if (!waitingWorker) {
    return null;
  }
  return <UpdatePrompt onUpdate={applyUpdate} isUpdating={isUpdating} />;
}
