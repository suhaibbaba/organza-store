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
  // Some browsers only start audio inside a user gesture.
  unlock: () => void;
}

export function useScanSound(): ScanSound {
  const isMuted = useSyncExternalStore(subscribeToScanSoundMuted, isScanSoundMuted, isScanSoundMutedOnServer);

  const toggleMute = useCallback(() => {
    const next = !isScanSoundMuted();
    setScanSoundMuted(next);
    // The tap that unmutes is itself the gesture iOS wants, so take it.
    if (!next) {
      unlockScanSound();
    }
  }, []);

  const play = useCallback(
    (variant: FeedbackVariant) => {
      if (isMuted) {
        return;
      }
      playScanTones(variant === "success" ? SCAN_SUCCESS_TONES : SCAN_ERROR_TONES);
    },
    [isMuted],
  );

  return { isMuted, toggleMute, play, unlock: unlockScanSound };
}
