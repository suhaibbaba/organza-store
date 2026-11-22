"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { routing } from "@/i18n/routing";
import { LOCALE_COOKIE_NAME } from "@/constants/locale";
import {
  OFFLINE_PATH,
  SERVICE_WORKER_LOCALE_COOKIE_PARAM,
  SERVICE_WORKER_OFFLINE_PARAM,
  SERVICE_WORKER_PATH,
  SERVICE_WORKER_SKIP_WAITING_MESSAGE,
  SERVICE_WORKER_VERSION_PARAM,
  UPDATE_GIVE_UP_MS,
  UPDATE_RELOAD_FALLBACK_MS,
} from "@/constants/pwa";
import { UpdateBar } from "@/components/pwa/update-bar";
import { hasOpenSale, subscribeOpenSale } from "@/lib/cart-stash";
import type { UpdatePhase } from "@/types";

// A deploy installs itself behind a strip and reloads, but only with no sale open: the reload would lose every cart.
export function ServiceWorkerRegistrar() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const saleOpen = useSyncExternalStore(subscribeOpenSale, hasOpenSale, () => false);
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
    });

    let registration: ServiceWorkerRegistration | undefined;
    // On a first install the worker claims the page quietly; only a worker replacing another is an update.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const takeUp = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) {
        setWaitingWorker(worker);
        setPhase("ready");
      }
    };

    const watchInstalling = (worker: ServiceWorker) => {
      if (navigator.serviceWorker.controller) {
        setPhase("downloading");
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          takeUp(worker);
        }
        if (worker.state === "redundant") {
          setPhase("idle");
        }
      });
    };

    navigator.serviceWorker
      // The browser must revalidate the worker script, not serve it from the HTTP cache.
      .register(`${SERVICE_WORKER_PATH}?${query.toString()}`, { scope: "/", updateViaCache: "none" })
      .then((result) => {
        registration = result;
        // Downloaded during an earlier visit and never taken up.
        takeUp(result.waiting);
        if (result.installing) {
          watchInstalling(result.installing);
        }
        result.addEventListener("updatefound", () => {
          if (result.installing) {
            watchInstalling(result.installing);
          }
        });
      })
      // Offline, private mode or unsupported: the app still works without a worker.
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

  // A download that never finishes must not leave the strip up for good.
  useEffect(() => {
    if (phase !== "downloading") {
      return;
    }
    const timer = window.setTimeout(() => setPhase("idle"), UPDATE_GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // skipWaiting fires controllerchange, which reloads; the timeout covers a worker that never answers.
  useEffect(() => {
    if (!waitingWorker || saleOpen || hasReloaded.current) {
      return;
    }
    waitingWorker.postMessage({ type: SERVICE_WORKER_SKIP_WAITING_MESSAGE });
    const timer = window.setTimeout(() => {
      if (!hasReloaded.current) {
        hasReloaded.current = true;
        window.location.reload();
      }
    }, UPDATE_RELOAD_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [waitingWorker, saleOpen]);

  return phase === "downloading" || (phase === "ready" && !saleOpen) ? <UpdateBar /> : null;
}
