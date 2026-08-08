export * from "@shared/constants/passwordSetup";

// --- rate limiting (spec.md "Auth (details)") ---------------------------
// The public "email me a link" endpoint is the one door into the system that
// needs no session, so it is limited twice: per caller, and per address.
//
// The PER-ADDRESS limit is the one doing the real work. Mail-bombing somebody
// and probing whether an address belongs to an account are both attacks on an
// address, and both are stopped by it however many machines they come from.
//
// The per-caller limit is a coarse flood stop and is deliberately loose,
// because "one caller" is not one person here: the whole shop shares a single
// public IP behind its router, and behind the VPS's reverse proxy every
// request looks like it came from nginx unless TRUST_PROXY is configured. A
// tight per-IP number would lock out the second member of staff to ask for a
// link, which is a real cost against no real attacker.

/** Per client IP. */
export const PASSWORD_RESET_IP_LIMIT = 60;
export const PASSWORD_RESET_IP_WINDOW_MS = 15 * 60 * 1000;

/** Per email address, whether or not it exists. This is the real defence. */
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/**
 * Redeeming or checking a link. Guessing a 256-bit token is not a threat
 * model, so this is purely a flood stop — and it has to leave room for the
 * set-password screen's own check-then-submit, several times over, from a
 * whole shop sharing one address.
 */
export const PASSWORD_SETUP_REDEEM_LIMIT = 60;
export const PASSWORD_SETUP_REDEEM_WINDOW_MS = 15 * 60 * 1000;

/**
 * How often the in-memory limiter sweeps expired buckets. Without it a long
 * uptime accumulates one entry per address ever seen.
 */
export const RATE_LIMIT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
