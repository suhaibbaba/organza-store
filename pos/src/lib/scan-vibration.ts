import { SCAN_ERROR_VIBRATION, SCAN_SUCCESS_VIBRATION } from "@/constants/feedback";
import { SCAN_VIBRATION_MUTED_KEY } from "@/constants/storage";
import { createDeviceFlag } from "@/lib/device-flag";
import type { FeedbackVariant, VibrationPattern } from "@/types/feedback";

// The felt half of scan feedback, and in this shop often the clearest one: a
// counter with a fan going and two customers talking is louder than a beep
// played at an eighth of full gain, and the phone is regularly face down under
// a pile of clothes. A buzz in the hand gets through all of that.
//
// It is a second answer to the same question, never a replacement — each cue
// covers where the others fail (the beep while the phone is out of reach, the
// buzz while the shop is loud, the toast while both are muted), and each can be
// silenced on its own.

export function isScanVibrationSupported(): boolean {
  // Chrome/Firefox on Android have this; iOS Safari does not expose the
  // Vibration API at all, so on an iPhone the switch is simply not offered
  // rather than offered and dead.
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrateScan(variant: FeedbackVariant): void {
  playPattern(variant === "success" ? SCAN_SUCCESS_VIBRATION : SCAN_ERROR_VIBRATION);
}

function playPattern(pattern: VibrationPattern): void {
  if (!isScanVibrationSupported()) return;
  try {
    // A pattern already running is cut off by the next call, which is what a
    // run of fast scans should feel like: the newest read is the one being
    // answered, not a queue of old ones buzzing through.
    navigator.vibrate([...pattern]);
  } catch {
    // Some browsers refuse outright (a tab that has never been interacted
    // with, a device policy). There is nothing to say about it: the beep and
    // the toast still answered.
  }
}

// ---- The mute switch ----------------------------------------------------
//
// Same store as the beep's (lib/device-flag.ts), same reasoning: it is a fact
// about where this phone is standing, remembered per device.

const mutedFlag = createDeviceFlag(SCAN_VIBRATION_MUTED_KEY);

export const subscribeToScanVibrationMuted = mutedFlag.subscribe;
export const isScanVibrationMuted = mutedFlag.read;
/** Server render: assume it buzzes, so the markup matches first paint. */
export const isScanVibrationMutedOnServer = mutedFlag.readOnServer;
export const setScanVibrationMuted = mutedFlag.write;
