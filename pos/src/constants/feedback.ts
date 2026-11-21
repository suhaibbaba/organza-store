import type { ScanTone, VibrationPattern } from "@/types/feedback";

// How long the same toast is not repeated for (a tag still lying under the camera).
export const FEEDBACK_TIMEOUT_MS = 3000;

// ---- Audible scan feedback (lib/scan-sound.ts) --------------------------
//
// The point of the sounds is to let the cashier keep their eyes on the
// clothes rather than the screen, so the two cues have to be tellable apart
// without thinking about it: "in the cart" is a single short blip up high,
// "that didn't read" is a longer, lower two-tone that falls. Nothing else
// in the app makes a noise, so there is nothing to confuse them with.

// Peak gain of a tone, 0–1. Deliberately low: this plays a few hundred
// times a shift, an arm's length from the cashier's face.
export const SCAN_SOUND_VOLUME = 0.12;

// Fade in/out either side of a tone. Without it the waveform starts and
// stops at full amplitude, which is heard as a click over the tone itself.
export const SCAN_SOUND_ENVELOPE_MS = 8;

// A tone is scheduled this far ahead of "now" rather than exactly at it.
// A note placed at currentTime is already partly in the past by the time the
// audio thread picks the work up — heard as a clipped beep, or as no beep at
// all on a phone busy decoding camera frames. Measured in Chromium, the gap
// between reading the clock and the oscillator actually starting can reach
// 20ms on the first beep after the context is built, so the lead sits above
// that. Nobody can hear 40ms of delay on a scan.
export const SCAN_SOUND_LEAD_MS = 40;

export const SCAN_SUCCESS_TONES: readonly ScanTone[] = [{ frequency: 1180, durationMs: 80 }];

export const SCAN_ERROR_TONES: readonly ScanTone[] = [
  { frequency: 320, durationMs: 120 },
  { frequency: 190, durationMs: 200 },
];

// ---- Haptic scan feedback (lib/scan-vibration.ts) -----------------------
//
// The shop is noisy — a fan, a till, two customers talking — and the phone
// is often face down on the counter with a pile of clothes over it, where a
// 0.12-gain beep simply loses. A buzz in the hand is read through all of
// that, so it is the second half of the same answer rather than a nicety.
//
// The two patterns are told apart by shape, not length, because a hand feels
// rhythm far better than duration: one tap means it went in, a stutter of
// three means it didn't read. Anything longer would still be buzzing when
// the next item is under the camera.
export const SCAN_SUCCESS_VIBRATION: VibrationPattern = [35];

export const SCAN_ERROR_VIBRATION: VibrationPattern = [70, 60, 70, 60, 140];
