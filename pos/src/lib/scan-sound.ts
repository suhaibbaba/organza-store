import { SCAN_SOUND_ENVELOPE_MS, SCAN_SOUND_LEAD_MS, SCAN_SOUND_VOLUME } from "@/constants/feedback";
import { SCAN_SOUND_MUTED_KEY } from "@/constants/storage";
import { createDeviceFlag } from "@/lib/device-flag";
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

// iOS hands out every audio context suspended, and a resume() is only granted
// from inside a user gesture — but a resume on its own is not what unlocks the
// output. Safari only counts the context as unlocked once a source node has
// actually run through it, so this pushes one frame of silence through as
// well: inaudible, and the difference between a shift that beeps and a shift
// that doesn't.
//
// Called from every tap that means "I am about to scan" — opening the camera,
// un-muting, the counter scanner's own keypress — and again once the camera is
// live, because starting a capture on iOS re-negotiates the audio session
// underneath us and can leave the context interrupted.
export function unlockScanSound(): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  primeOutput(ctx);
}

// One sample of nothing, played now. This is the part iOS actually wants.
function primeOutput(ctx: AudioContext): void {
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    source.connect(ctx.destination);
    source.start();
  } catch {
    // A context that refuses to build a one-frame buffer is not going to
    // make a beep either; the cashier still has the toast and the buzz.
  }
}

// Plays the tones back to back.
//
// The scan that produced them came from a camera callback, not from a tap, so
// the context may well be suspended — which is precisely how this went silent
// before: a suspended context's clock does not advance, so tones scheduled
// against `currentTime` sat at a moment that had already passed by the time it
// resumed, and nothing was ever heard. So resume FIRST, and only schedule once
// the clock is running again.
export function playScanTones(tones: readonly ScanTone[]): void {
  const ctx = audioContext();
  if (!ctx) return;

  if (ctx.state === "running") {
    schedule(ctx, tones);
    return;
  }

  void ctx
    .resume()
    .then(() => schedule(ctx, tones))
    .catch(() => {
      // No gesture has reached this tab yet, so the browser is entitled to
      // refuse. The next tap on the scan button unlocks it (unlockScanSound),
      // and until then the toast and the vibration carry the answer.
    });
}

// Scheduled on the audio clock rather than with timers so the two halves of
// the failure cue stay glued together even while the main thread is busy
// decoding camera frames and rendering the cart.
function schedule(ctx: AudioContext, tones: readonly ScanTone[]): void {
  const envelope = SCAN_SOUND_ENVELOPE_MS / 1000;
  let at = ctx.currentTime + SCAN_SOUND_LEAD_MS / 1000;

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
// Remembered per device (constants/storage.ts). The store itself is
// lib/device-flag.ts, shared with the vibration switch — the two behave
// identically, and one implementation is one thing to get right.
//
// Note for anyone chasing "the beep is on but I hear nothing" on an iPhone:
// iOS silences Web Audio outright while the ring/silent switch is set to
// silent. Nothing on this side can override that, which is the other reason
// the buzz exists (lib/scan-vibration.ts).

const mutedFlag = createDeviceFlag(SCAN_SOUND_MUTED_KEY);

export const subscribeToScanSoundMuted = mutedFlag.subscribe;
export const isScanSoundMuted = mutedFlag.read;
/** Server render: assume audible, so the markup matches first paint. */
export const isScanSoundMutedOnServer = mutedFlag.readOnServer;
export const setScanSoundMuted = mutedFlag.write;
