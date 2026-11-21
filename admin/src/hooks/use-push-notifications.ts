"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PUSH_CONFIG_QUERY_KEY } from "@/constants/api";
import { fetchPushConfig, subscribeToPush, unsubscribeFromPush } from "@/lib/api/push";
import {
  createSubscription,
  dropSubscription,
  getExistingSubscription,
  isIOSDevice,
  isPushSupported,
} from "@/lib/push-subscription";
import { isInstalledApp } from "@/lib/pwa";
import type { PushActionState, PushBlockedReason, PushNotificationState } from "@/types/push";

// Permission is always read from the browser, so one revoked in phone settings shows at once.
export function usePushNotifications(): PushNotificationState {
  const locale = useLocale();
  const [isReady, setIsReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [action, setAction] = useState<PushActionState>("idle");

  // Fetched, not baked in, so rotating the VAPID keys needs no rebuild.
  const { data: config } = useQuery({ queryKey: PUSH_CONFIG_QUERY_KEY, queryFn: fetchPushConfig, staleTime: Infinity });
  const publicKey = config?.publicKey ?? null;
  const isConfigured = config?.configured ?? true;

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const canPush = isPushSupported();
      const existing = canPush ? await getExistingSubscription() : null;
      if (cancelled) {
        return;
      }

      setSupported(canPush);
      setPermission(canPush ? Notification.permission : null);
      setIsSubscribed(Boolean(existing));
      setIsIOS(isIOSDevice());
      setIsInstalled(isInstalledApp());
      setIsReady(true);
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!publicKey) {
      return;
    }
    setAction("pending");
    try {
      // Only a click lets the browser show the permission prompt.
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") {
        setAction("idle");
        return;
      }

      await subscribeToPush(await createSubscription(publicKey, locale));
      setIsSubscribed(true);
      setAction("idle");
    } catch {
      setAction("error");
    }
  }, [publicKey, locale]);

  const disable = useCallback(async () => {
    setAction("pending");
    try {
      const endpoint = await dropSubscription();
      // Tell the API too, so it stops pushing at this device.
      if (endpoint) {
        await unsubscribeFromPush({ endpoint }).catch(() => undefined);
      }
      setIsSubscribed(false);
      setAction("idle");
    } catch {
      setAction("error");
    }
  }, []);

  return {
    isReady,
    permission,
    isSubscribed,
    blockedReason: resolveBlockedReason({
      supported,
      isIOS,
      isInstalled,
      configured: isConfigured,
      permission,
    }),
    isIOS,
    isInstalled,
    action,
    enable,
    disable,
  };
}

// Ordered by what the user must do about it.
function resolveBlockedReason(state: {
  supported: boolean;
  isIOS: boolean;
  isInstalled: boolean;
  configured: boolean;
  permission: NotificationPermission | null;
}): PushBlockedReason | null {
  if (state.isIOS && !state.isInstalled) {
    return "needs-install";
  }
  if (!state.supported) {
    return "unsupported";
  }
  if (!state.configured) {
    return "not-configured";
  }
  if (state.permission === "denied") {
    return "denied";
  }
  return null;
}
