"use client";

import { useCallback } from "react";
import { useScanSound, type ScanSound } from "@/hooks/use-scan-sound";
import { useScanVibration, type ScanVibration } from "@/hooks/use-scan-vibration";
import type { FeedbackVariant } from "@/types/feedback";

export interface ScanFeedback {
  sound: ScanSound;
  vibration: ScanVibration;
  play: (variant: FeedbackVariant) => void;
  // Some browsers only start audio inside a user gesture; vibration needs no priming.
  unlock: () => void;
}

// Beep and buzz, each with its own switch: the cashier is looking at the clothes, not the phone.
export function useScanFeedback(): ScanFeedback {
  const sound = useScanSound();
  const vibration = useScanVibration();

  const { play: playSound } = sound;
  const { vibrate } = vibration;

  const play = useCallback(
    (variant: FeedbackVariant) => {
      playSound(variant);
      vibrate(variant);
    },
    [playSound, vibrate],
  );

  return { sound, vibration, play, unlock: sound.unlock };
}
