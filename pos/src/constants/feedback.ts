import type { ScanTone } from "@/types/feedback";

// How long a self-clearing confirmation ("added to cart", "no such
// barcode") stays on screen. Long enough to read at a glance while handling
// an item, short enough that it never lingers into the next scan.
export const FEEDBACK_TIMEOUT_MS = 3000;

// How many confirmations may stack at once. Kept low because the column
// hangs over the cart: repeats of one item collapse into a single counting
// toast (hooks/use-toasts.ts), so reaching even two means genuinely
// different items landed within a few seconds of each other.
export const MAX_VISIBLE_TOASTS = 2;

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

export const SCAN_SUCCESS_TONES: readonly ScanTone[] = [{ frequency: 1180, durationMs: 80 }];

export const SCAN_ERROR_TONES: readonly ScanTone[] = [
  { frequency: 320, durationMs: 120 },
  { frequency: 190, durationMs: 200 },
];
