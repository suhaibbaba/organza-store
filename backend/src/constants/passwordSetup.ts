export * from "@store/shared/constants/passwordSetup";

// The public "email me a link" endpoint is limited per caller and per address; the per-address limit does the real work.

/** Per client IP. */
export const PASSWORD_RESET_IP_LIMIT = 60;
export const PASSWORD_RESET_IP_WINDOW_MS = 15 * 60 * 1000;

/** Per email address, whether or not it exists. This is the real defence. */
export const PASSWORD_RESET_EMAIL_LIMIT = 3;
export const PASSWORD_RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/** Redeeming or checking a link: only a flood stop, roomy enough for a whole shop behind one address. */
export const PASSWORD_SETUP_REDEEM_LIMIT = 60;
export const PASSWORD_SETUP_REDEEM_WINDOW_MS = 15 * 60 * 1000;

/** How often the in-memory limiter sweeps expired buckets. */
export const RATE_LIMIT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
