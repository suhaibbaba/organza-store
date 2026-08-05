"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SCAN_ERROR_TONES, SCAN_SUCCESS_TONES } from "@/constants/feedback";
import {
  isScanSoundMuted,
  isScanSoundMutedOnServer,
  playScanTones,
  setScanSoundMuted,
  subscribeToScanSoundMuted,
  unlockScanSound,
} from "@/lib/scan-sound";
import type { FeedbackVariant } from "@/types/feedback";

export interface ScanSound {
  isMuted: boolean;
  toggleMute: () => void;
  play: (variant: FeedbackVariant) => void;
  // Called from the tap that starts a scanning run, to satisfy the browsers
  // that only let audio begin inside a user gesture.
  unlock: () => void;
}

// Beeps for scanning, with the mute switch that goes with them.
//
// A cashier working a queue is looking at the clothes and the customer, not
// at a phone propped up by the till — the sound is what tells them the item
// went in, and the different sound is what stops them handing over something
// that never scanned.
export function useScanSound(): ScanSound {
  const isMuted = useSyncExternalStore(subscribeToScanSoundMuted, isScanSoundMuted, isScanSoundMutedOnServer);

  const toggleMute = useCallback(() => {
    const next = !isScanSoundMuted();
    setScanSoundMuted(next);
    // The tap that turns the sound back on is itself the gesture iOS wants,
    // so take it — otherwise the next scan is silent anyway and the switch
    // looks broken.
    if (!next) unlockScanSound();
  }, []);

  const play = useCallback(
    (variant: FeedbackVariant) => {
      if (isMuted) return;
      playScanTones(variant === "success" ? SCAN_SUCCESS_TONES : SCAN_ERROR_TONES);
    },
    [isMuted]
  );

  return { isMuted, toggleMute, play, unlock: unlockScanSound };
}
