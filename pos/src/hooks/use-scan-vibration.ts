"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  isScanVibrationMuted,
  isScanVibrationMutedOnServer,
  isScanVibrationSupported,
  setScanVibrationMuted,
  subscribeToScanVibrationMuted,
  vibrateScan,
} from "@/lib/scan-vibration";
import type { FeedbackVariant } from "@/types/feedback";

export interface ScanVibration {
  // False on iPhones (no Vibration API in Safari) and on desktops, where the
  // switch has nothing to switch and so isn't shown.
  isSupported: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  vibrate: (variant: FeedbackVariant) => void;
}

// Nothing ever changes whether the device can buzz, so there is nothing to
// subscribe to — but the answer still has to come through useSyncExternalStore
// so the server render (false) and the first client paint agree instead of
// hydrating into a mismatch.
const neverChanges = () => () => {};

// The buzz that goes with the beep, and the switch that silences it.
export function useScanVibration(): ScanVibration {
  const isSupported = useSyncExternalStore(neverChanges, isScanVibrationSupported, () => false);
  const isMuted = useSyncExternalStore(
    subscribeToScanVibrationMuted,
    isScanVibrationMuted,
    isScanVibrationMutedOnServer
  );

  const toggleMute = useCallback(() => {
    const next = !isScanVibrationMuted();
    setScanVibrationMuted(next);
    // Turning it back on buzzes once, then and there: the cashier asked for
    // the cue, so show them what they just switched on rather than making
    // them scan something to find out.
    if (!next) vibrateScan("success");
  }, []);

  const vibrate = useCallback(
    (variant: FeedbackVariant) => {
      if (isMuted) return;
      vibrateScan(variant);
    },
    [isMuted]
  );

  return { isSupported, isMuted, toggleMute, vibrate };
}
