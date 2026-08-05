// Bearer session token (see backend `bearer` plugin) — mirrored into both
// localStorage (read by client code) and a plain cookie (read by proxy.ts
// for the optimistic redirect, since proxy can't read localStorage).
//
// Deliberately a different key from the admin app's: the two can be open in
// the same browser on the same device, and a shared key would let a logout
// in one silently sign the other out mid-sale.
export const SESSION_TOKEN_KEY = "organza_pos_session_token";

// Whether the scan beeps are silenced. Per device rather than per account:
// it answers "is this till in a quiet corner", which is a fact about where
// the phone is standing, not about who picked it up.
export const SCAN_SOUND_MUTED_KEY = "organza_pos_scan_sound_muted";

// Matches the backend's default SESSION_EXPIRES_IN_DAYS (backend/.env.example)
// — only used as the cookie's Max-Age; the backend is the source of truth
// for actual session validity.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
