export * from "@store/shared/constants/push";

// Env vars holding this server's VAPID identity: generated once, never committed; changing them kills every subscription.
export const PUSH_ENV_KEYS = {
  PUBLIC_KEY: "VAPID_PUBLIC_KEY",
  PRIVATE_KEY: "VAPID_PRIVATE_KEY",
  SUBJECT: "VAPID_SUBJECT",
} as const;

/** The only push-service answers that mean the subscription is dead; anything else is transient and keeps the row. */
export const PUSH_GONE_STATUS_CODES = [404, 410] as const;

/** How long a push service holds an undelivered notification: a sale is news for hours, not a week. */
export const PUSH_TTL_SECONDS = 60 * 60 * 6;

/** Ceiling on one fan-out, so a notification can never become an unbounded job. */
export const MAX_PUSH_RECIPIENTS = 200;
