"use client";

import { useEffect, useRef } from "react";
import { POS_AUTO_LOCK_OFF } from "@store/shared/constants/posLock";
import { useSession } from "@/components/providers/session-provider";
import { useSettingsQuery } from "@/hooks/use-settings";
import { AUTO_LOCK_ACTIVITY_EVENTS, AUTO_LOCK_CHECK_INTERVAL_MS, MS_PER_MINUTE } from "@/constants/auth";

// Locks the till after the shop's set minutes without a tap; time spent in the background counts too.
export function AutoLock() {
  const { canLock, lock } = useSession();
  const minutes = useSettingsQuery().data?.posAutoLockMinutes ?? POS_AUTO_LOCK_OFF;
  const lastActivity = useRef(0);

  useEffect(() => {
    if (!canLock || minutes === POS_AUTO_LOCK_OFF) {
      return;
    }
    const limit = minutes * MS_PER_MINUTE;
    lastActivity.current = Date.now();

    function touched() {
      lastActivity.current = Date.now();
    }
    // A sleeping tablet runs no timers, so the check also runs the moment it is woken.
    function check() {
      if (Date.now() - lastActivity.current >= limit) {
        void lock();
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        check();
      }
    }

    for (const event of AUTO_LOCK_ACTIVITY_EVENTS) {
      window.addEventListener(event, touched, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, AUTO_LOCK_CHECK_INTERVAL_MS);

    return () => {
      for (const event of AUTO_LOCK_ACTIVITY_EVENTS) {
        window.removeEventListener(event, touched, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [canLock, minutes, lock]);

  return null;
}
