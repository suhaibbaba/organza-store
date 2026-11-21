// Mirrored to localStorage and a cookie (proxy.ts can't read localStorage); a different key from the admin's.
export const SESSION_TOKEN_KEY = "store_pos_session_token";

// Per device, not per account: it answers whether this till stands in a quiet corner.
export const SCAN_SOUND_MUTED_KEY = "store_pos_scan_sound_muted";

// Separate from the beep: a quiet corner and a rattling counter are different problems.
export const SCAN_VIBRATION_MUTED_KEY = "store_pos_scan_vibration_muted";

// Matches the backend's default SESSION_EXPIRES_IN_DAYS; only the cookie Max-Age, the backend decides validity.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
