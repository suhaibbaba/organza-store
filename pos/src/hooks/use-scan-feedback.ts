"use client";

import { useCallback } from "react";
import { useScanSound, type ScanSound } from "@/hooks/use-scan-sound";
import { useScanVibration, type ScanVibration } from "@/hooks/use-scan-vibration";
import type { FeedbackVariant } from "@/types/feedback";

export interface ScanFeedback {
  sound: ScanSound;
  vibration: ScanVibration;
  // Both cues at once, which is how every scan is answered — the caller says
  // what happened, not which hardware should say it.
  play: (variant: FeedbackVariant) => void;
  // Called from the tap that starts a run of scanning, to satisfy the
  // browsers that only let audio begin inside a user gesture. Vibration needs
  // no such priming, so this is the sound's alone.
  unlock: () => void;
}

// What a scan feels like: the beep and the buzz, each with its own switch,
// asked for together.
//
// A cashier working a queue is looking at the clothes and the customer, not at
// a phone propped up by the till. The beep tells them the item went in; the
// buzz tells them the same thing when the shop is too loud for the beep, or
// when iOS has silenced Web Audio because the ring switch is off. Both make a
// clearly different noise/shape for a scan that did NOT read, which is what
// stops an item being handed over unpaid.
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
    [playSound, vibrate]
  );

  return { sound, vibration, play, unlock: sound.unlock };
}
