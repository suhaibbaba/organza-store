// What a piece of transient feedback is saying. Success and failure are the
// only two answers the selling screen ever gives back for an action, and the
// toast, the scanner's own flash and the beep all read the same value — so a
// scan that sounds wrong also looks wrong, and vice versa.
export type FeedbackVariant = "success" | "destructive";

// One step of an audible cue (lib/scan-sound.ts). A cue is a list of these
// played back to back, which is what makes "added" and "didn't read"
// distinguishable by ear alone: one blip versus a falling two-tone.
export interface ScanTone {
  frequency: number;
  durationMs: number;
}

// A per-device yes/no preference (lib/device-flag.ts), in the shape
// useSyncExternalStore wants: the browser owns the value, React only
// subscribes to it.
export interface DeviceFlag {
  subscribe: (onChange: () => void) => () => void;
  read: () => boolean;
  readOnServer: () => boolean;
  write: (value: boolean) => void;
}

// A haptic cue, in the shape the Vibration API takes: alternating buzz and
// pause lengths in milliseconds, starting with a buzz. A single-element
// pattern is therefore one plain buzz.
export type VibrationPattern = readonly number[];

// A one-shot visual acknowledgement — the cart line that just grew, or the
// viewfinder frame after a read. The token is what makes it repeatable: the
// same line scanned twice in a row changes the token, and the animation
// restarts instead of sitting there already finished.
export interface ScanFlash {
  token: number;
  variant: FeedbackVariant;
}
