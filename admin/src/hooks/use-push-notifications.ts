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
  isInstalledApp,
  isPushSupported,
} from "@/lib/push-subscription";
import type { PushActionState, PushBlockedReason, PushNotificationState } from "@/types/push";

// Sale notifications, as this device sees them.
//
// Everything below reports what the browser actually says — the permission
// is read from `Notification.permission`, never remembered in our own state,
// so a permission revoked in the phone's settings shows up here as soon as
// the screen is opened rather than leaving a switch stuck on.
export function usePushNotifications(): PushNotificationState {
  const locale = useLocale();
  const [isReady, setIsReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [action, setAction] = useState<PushActionState>("idle");

  // The server's VAPID public key. Fetched rather than baked into the bundle
  // at build time, so rotating the key pair on the VPS doesn't need a rebuild
  // of the admin.
  const { data: config } = useQuery({ queryKey: PUSH_CONFIG_QUERY_KEY, queryFn: fetchPushConfig, staleTime: Infinity });
  const publicKey = config?.publicKey ?? null;
  const isConfigured = config?.configured ?? true;

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const canPush = isPushSupported();
      const existing = canPush ? await getExistingSubscription() : null;
      if (cancelled) return;

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
    if (!publicKey) return;
    setAction("pending");
    try {
      // Asked from the button's own click, which is the only moment a
      // browser will show the permission prompt.
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
      // The message under the switch is the user's answer; the technical
      // detail belongs in the browser console, not on a shop phone.
      setAction("error");
    }
  }, [publicKey, locale]);

  const disable = useCallback(async () => {
    setAction("pending");
    try {
      const endpoint = await dropSubscription();
      // Told to the API too, so it stops pushing at a device that has gone
      // quiet — rather than waiting to learn from the push service.
      if (endpoint) await unsubscribeFromPush({ endpoint }).catch(() => undefined);
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

// Ordered by what the user would have to do about it: a browser that can't
// do push at all, then an iPhone that needs installing first, then a server
// with no keys, then a permission that was refused.
function resolveBlockedReason(state: {
  supported: boolean;
  isIOS: boolean;
  isInstalled: boolean;
  configured: boolean;
  permission: NotificationPermission | null;
}): PushBlockedReason | null {
  if (state.isIOS && !state.isInstalled) return "needs-install";
  if (!state.supported) return "unsupported";
  if (!state.configured) return "not-configured";
  if (state.permission === "denied") return "denied";
  return null;
}
