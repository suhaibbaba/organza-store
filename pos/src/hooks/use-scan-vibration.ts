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
  // False on iPhones and desktops, where the switch isn't shown.
  isSupported: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  vibrate: (variant: FeedbackVariant) => void;
}

// Through useSyncExternalStore so the server render (false) and the first client paint agree.
const neverChanges = () => () => {};

// The buzz that goes with the beep, and the switch that silences it.
export function useScanVibration(): ScanVibration {
  const isSupported = useSyncExternalStore(neverChanges, isScanVibrationSupported, () => false);
  const isMuted = useSyncExternalStore(
    subscribeToScanVibrationMuted,
    isScanVibrationMuted,
    isScanVibrationMutedOnServer,
  );

  const toggleMute = useCallback(() => {
    const next = !isScanVibrationMuted();
    setScanVibrationMuted(next);
    // Turning it on buzzes once, so the cashier feels what they just enabled.
    if (!next) {
      vibrateScan("success");
    }
  }, []);

  const vibrate = useCallback(
    (variant: FeedbackVariant) => {
      if (isMuted) {
        return;
      }
      vibrateScan(variant);
    },
    [isMuted],
  );

  return { isSupported, isMuted, toggleMute, vibrate };
}
