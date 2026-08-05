import { SCAN_SOUND_ENVELOPE_MS, SCAN_SOUND_VOLUME } from "@/constants/feedback";
import { SCAN_SOUND_MUTED_KEY } from "@/constants/storage";
import type { ScanTone } from "@/types/feedback";

// The audible half of scan feedback. Synthesised rather than played from
// files: two short tones are a few lines of oscillator, and a POS that is
// used all day on a phone should not be waiting on an asset download —
// nor go silent the first time it is offline.
//
// Everything about the browser's audio lives in here, so muting, unlocking
// and the tones themselves have exactly one implementation to check.

type AudioContextConstructor = new () => AudioContext;

// One context for the life of the tab. Browsers cap how many a page may
// open, and a POS makes this noise hundreds of times a shift.
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  const Ctor = window.AudioContext ?? withWebkit.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  return context;
}

// iOS hands out every audio context suspended and only resumes one from
// inside a user gesture. Called from the taps that mean "I am about to
// scan" (opening the scanner, un-muting), so the first successful read
// actually makes a sound instead of silently failing.
export function unlockScanSound(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

// Plays the tones back to back. Scheduled on the audio clock rather than
// with timers so the two halves of the failure cue stay glued together even
// while the main thread is busy rendering the cart.
export function playScanTones(tones: readonly ScanTone[]): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const envelope = SCAN_SOUND_ENVELOPE_MS / 1000;
  let at = ctx.currentTime;

  for (const tone of tones) {
    const seconds = tone.durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, at);

    // Ramped in and out: a gain that jumps straight to full puts an audible
    // click either side of every beep, which over a shift is worse than the
    // beep itself.
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(SCAN_SOUND_VOLUME, at + envelope);
    gain.gain.setValueAtTime(SCAN_SOUND_VOLUME, at + Math.max(envelope, seconds - envelope));
    gain.gain.linearRampToValueAtTime(0, at + seconds);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + seconds);

    at += seconds;
  }
}

// ---- The mute switch ----------------------------------------------------
//
// Remembered per device (constants/storage.ts) and shaped for
// useSyncExternalStore, like the app's other browser-owned facts (lib/pwa.ts)
// — read from where it actually lives rather than mirrored into React state,
// so there is nothing to set in an effect and nothing to go stale.
//
// Storage can throw outright — Safari in private mode, a locked-down kiosk
// profile — and a till that cannot remember a preference must still sell, so
// every path falls back to "not muted" rather than to an error.

const mutedListeners = new Set<() => void>();
// Read once and kept, because getSnapshot runs on every render.
let mutedCache: boolean | null = null;

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(SCAN_SOUND_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function handleStorageChange(event: StorageEvent) {
  // key === null is a whole-storage clear, which counts.
  if (event.key !== null && event.key !== SCAN_SOUND_MUTED_KEY) return;
  mutedCache = readMuted();
  mutedListeners.forEach((listener) => listener());
}

export function subscribeToScanSoundMuted(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  mutedListeners.add(onChange);
  // The same till can have the POS open in two tabs; muting in one should
  // not leave the other beeping.
  if (mutedListeners.size === 1) window.addEventListener("storage", handleStorageChange);
  return () => {
    mutedListeners.delete(onChange);
    if (mutedListeners.size === 0) window.removeEventListener("storage", handleStorageChange);
  };
}

export function isScanSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  if (mutedCache === null) mutedCache = readMuted();
  return mutedCache;
}

/** Server render: assume audible, so the markup matches first paint. */
export const isScanSoundMutedOnServer = (): boolean => false;

export function setScanSoundMuted(muted: boolean): void {
  mutedCache = muted;
  try {
    window.localStorage.setItem(SCAN_SOUND_MUTED_KEY, String(muted));
  } catch {
    // Nothing to tell the cashier: the setting still holds for this tab, it
    // just won't survive a reload.
  }
  mutedListeners.forEach((listener) => listener());
}
