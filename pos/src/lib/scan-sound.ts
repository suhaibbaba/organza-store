import { SCAN_SOUND_ENVELOPE_MS, SCAN_SOUND_LEAD_MS, SCAN_SOUND_VOLUME } from "@/constants/feedback";
import { SCAN_SOUND_MUTED_KEY } from "@/constants/storage";
import { createDeviceFlag } from "@/lib/device-flag";
import type { ScanTone } from "@/types/feedback";

// Synthesised, not files: no asset to download, and it keeps working offline.

type AudioContextConstructor = new () => AudioContext;

// One context per tab: browsers cap how many a page may open.
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  const Ctor = window.AudioContext ?? withWebkit.webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!context) {
    context = new Ctor();
  }
  return context;
}

// iOS only unlocks a context once a source node has run through it inside a gesture, hence the silent buffer.
export function unlockScanSound(): void {
  const ctx = audioContext();
  if (!ctx) {
    return;
  }
  if (ctx.state !== "running") {
    void ctx.resume().catch(() => {});
  }
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
    // No beep possible; the toast and the buzz still answer.
  }
}

// Resumes first: a suspended context's clock doesn't advance, so tones scheduled against it never play.
export function playScanTones(tones: readonly ScanTone[]): void {
  const ctx = audioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === "running") {
    schedule(ctx, tones);
    return;
  }

  void ctx
    .resume()
    .then(() => schedule(ctx, tones))
    .catch(() => {
      // No gesture yet; the next tap on the scan button unlocks it.
    });
}

// On the audio clock, so the two-tone failure cue stays together while the main thread is busy.
function schedule(ctx: AudioContext, tones: readonly ScanTone[]): void {
  const envelope = SCAN_SOUND_ENVELOPE_MS / 1000;
  let at = ctx.currentTime + SCAN_SOUND_LEAD_MS / 1000;

  for (const tone of tones) {
    const seconds = tone.durationMs / 1000;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, at);

    // Ramped, or every beep clicks on both sides.
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

// Mute switch, per device; the store is lib/device-flag.ts, shared with the vibration switch.

const mutedFlag = createDeviceFlag(SCAN_SOUND_MUTED_KEY);

export const subscribeToScanSoundMuted = mutedFlag.subscribe;
export const isScanSoundMuted = mutedFlag.read;
/** Server render: assume audible, so the markup matches first paint. */
export const isScanSoundMutedOnServer = mutedFlag.readOnServer;
export const setScanSoundMuted = mutedFlag.write;
