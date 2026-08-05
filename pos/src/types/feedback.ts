// What a piece of transient feedback is saying. Success and failure are the
// only two answers the selling screen ever gives back for an action, and the
// toast, the scanner's own flash and the beep all read the same value — so a
// scan that sounds wrong also looks wrong, and vice versa.
export type FeedbackVariant = "success" | "destructive";

// One message in the toast queue. Short-lived by construction: it carries no
// action and no dismiss requirement, because a cashier mid-sale must never
// have to put an item down to clear something off the screen.
export interface Toast {
  // Monotonic, so re-showing the same text still animates as a new toast.
  id: number;
  // What this toast is about — a cart line, an error code. Two messages
  // sharing a key are the same news told twice, and the second rewrites the
  // first instead of stacking on it.
  key?: string;
  variant: FeedbackVariant;
  text: string;
}

// One step of an audible cue (lib/scan-sound.ts). A cue is a list of these
// played back to back, which is what makes "added" and "didn't read"
// distinguishable by ear alone: one blip versus a falling two-tone.
export interface ScanTone {
  frequency: number;
  durationMs: number;
}

// A one-shot visual acknowledgement — the cart line that just grew, or the
// viewfinder frame after a read. The token is what makes it repeatable: the
// same line scanned twice in a row changes the token, and the animation
// restarts instead of sitting there already finished.
export interface ScanFlash {
  token: number;
  variant: FeedbackVariant;
}
