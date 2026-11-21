import { SCAN_ERROR_VIBRATION, SCAN_SUCCESS_VIBRATION } from "@/constants/feedback";
import { SCAN_VIBRATION_MUTED_KEY } from "@/constants/storage";
import { createDeviceFlag } from "@/lib/device-flag";
import type { FeedbackVariant, VibrationPattern } from "@/types/feedback";

// Often the clearest cue: a noisy counter drowns the beep, and the phone may be face down under clothes.

export function isScanVibrationSupported(): boolean {
  // iOS Safari has no Vibration API, so the switch is not offered there.
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrateScan(variant: FeedbackVariant): void {
  playPattern(variant === "success" ? SCAN_SUCCESS_VIBRATION : SCAN_ERROR_VIBRATION);
}

function playPattern(pattern: VibrationPattern): void {
  if (!isScanVibrationSupported()) {
    return;
  }
  try {
    // The next call cuts off a running pattern, so fast scans answer the newest read.
    navigator.vibrate([...pattern]);
  } catch {
    // Refused (no interaction yet, or device policy): the beep and toast still answered.
  }
}

// Mute switch, per device, same store as the beep's.

const mutedFlag = createDeviceFlag(SCAN_VIBRATION_MUTED_KEY);

export const subscribeToScanVibrationMuted = mutedFlag.subscribe;
export const isScanVibrationMuted = mutedFlag.read;
/** Server render: assume it buzzes, so the markup matches first paint. */
export const isScanVibrationMutedOnServer = mutedFlag.readOnServer;
export const setScanVibrationMuted = mutedFlag.write;
