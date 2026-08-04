export * from "@shared/constants/push";

// Environment variables holding the VAPID identity of this server. Generated
// once per deployment (`npx web-push generate-vapid-keys`) and kept in the
// VPS's .env — never committed, and never regenerated casually: changing
// them invalidates every subscription already on a phone.
export const PUSH_ENV_KEYS = {
  PUBLIC_KEY: "VAPID_PUBLIC_KEY",
  PRIVATE_KEY: "VAPID_PRIVATE_KEY",
  SUBJECT: "VAPID_SUBJECT",
} as const;

/**
 * What a push service answers when the subscription is dead — the phone was
 * wiped, the app uninstalled, the permission revoked. These are the only
 * responses that justify deleting a row: everything else (a 500, a timeout,
 * a DNS failure) is the push service having a bad day, and throwing away the
 * shop's subscriptions over it would silently turn notifications off.
 */
export const PUSH_GONE_STATUS_CODES = [404, 410] as const;

/**
 * How long a push service should hold an undelivered notification. A sale is
 * news for a few hours, not for a week — after that the admin will see it in
 * the orders list anyway.
 */
export const PUSH_TTL_SECONDS = 60 * 60 * 6;

/** Ceiling on one fan-out, so a notification can never become an unbounded job. */
export const MAX_PUSH_RECIPIENTS = 200;
