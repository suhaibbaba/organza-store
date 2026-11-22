/**
 * "Email me a link." Reachable without a session, for the obvious reason —
 * somebody who cannot sign in cannot sign in to ask (see src/proxy.ts).
 *
 * The link itself lands on the ADMIN app's set-password screen, because that
 * is the address the backend builds it from (ADMIN_URL). The POS therefore
 * needs the request screen and not the redeem one.
 */
export const FORGOT_PASSWORD_PATH = "/forgot-password";

export const LOGIN_HREF = "/login";
// How often the till checks whether it has sat untouched long enough to lock.
export const AUTO_LOCK_CHECK_INTERVAL_MS = 15 * 1000;
// What counts as somebody using the till; a hardware scanner types, so keydown covers it.
export const AUTO_LOCK_ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
export const MS_PER_MINUTE = 60 * 1000;
