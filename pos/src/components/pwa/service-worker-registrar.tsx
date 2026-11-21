"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { routing } from "@/i18n/routing";
import { LOCALE_COOKIE_NAME } from "@/constants/locale";
import {
  OFFLINE_PATH,
  SERVICE_WORKER_LOCALE_COOKIE_PARAM,
  SERVICE_WORKER_OFFLINE_PARAM,
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SKIP_WAITING_MESSAGE,
  SERVICE_WORKER_VERSION_PARAM,
  UPDATE_RELOAD_FALLBACK_MS,
} from "@/constants/pwa";
import { UpdatePrompt } from "@/components/pwa/update-prompt";

// The new worker waits; this prompts for the update, since an installed app has no reload button.
export function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // One reload ever: controllerchange can fire more than once.
  const hasReloaded = useRef(false);

  useEffect(() => {
    // Caching dev chunks only fights hot reload.
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
    });

    let registration: ServiceWorkerRegistration | undefined;
    // A first install's controller change has nothing stale behind it, so it must not reload.
    const hadController = Boolean(navigator.serviceWorker.controller);

    // Only an update when something already controls the page; a first install takes over quietly.
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
      // updateViaCache none: the worker script itself is always revalidated.
      .register(`${SERVICE_WORKER_PATH}?${query.toString()}`, { scope: "/", updateViaCache: "none" })
      .then((result) => {
        registration = result;
        // Downloaded on an earlier visit and never taken up.
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
      // Offline, private mode or unsupported: the app works without a worker, so stay silent.
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
    // The timeout covers a worker that never answers: reloading anyway beats a dead button.
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
