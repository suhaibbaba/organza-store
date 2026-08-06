// Web Push — sale notifications for the Admins.
//
// The transport is the free Web Push standard (VAPID + the browser's own
// push service), so there is no paid notification service anywhere here, in
// line with the deployment rules in CLAUDE.md.

/**
 * Every mode the Setting can hold. Only the modes in
 * IMPLEMENTED_SALE_NOTIFICATION_MODES may actually be saved today — the rest
 * exist so that adding one later is a new branch in the decision function
 * plus an entry in that list, with no migration and no settings redesign.
 * Mirrors `enum SaleNotificationMode` in backend/prisma/schema.prisma.
 */
export const SALE_NOTIFICATION_MODES = ["EVERY_SALE", "ABOVE_AMOUNT", "PERIODIC_SUMMARY"] as const;

/** What the API accepts and the admin offers right now. */
export const IMPLEMENTED_SALE_NOTIFICATION_MODES = ["EVERY_SALE"] as const;

/**
 * Which roles' sales are worth telling the Admins about. A sale rung up by
 * an Admin is not: they were standing there. The author is excluded from the
 * recipients regardless, so nobody is ever notified of their own sale.
 */
export const SALE_NOTIFICATION_TRIGGER_ROLES = ["MANAGER", "EMPLOYEE"] as const;

/** Initial values of the Setting singleton — the Prisma defaults mirror these. */
export const SALE_NOTIFICATION_DEFAULTS = {
  enabled: true,
  mode: "EVERY_SALE",
  minAmount: "0",
} as const;

/**
 * How many item names a notification names before it falls back to
 * "and N more". A phone shows about two lines of body text.
 */
export const MAX_NOTIFICATION_ITEM_NAMES = 2;

/**
 * Translation keys the service worker renders the notification with. The
 * backend never emits a user-facing sentence (CLAUDE.md rule 12) — it emits
 * these keys plus the numbers, exactly as it does for error codes, and the
 * admin app resolves them in the reader's own language.
 */
export const PUSH_MESSAGE_KEYS = {
  SALE_TITLE: "push.sale.title",
  SALE_BODY: "push.sale.body",
  SALE_ITEM_SEPARATOR: "push.sale.itemSeparator",
  SALE_MORE_ITEMS: "push.sale.moreItems",
  // Somebody asked for a change they may not make themselves (spec.md
  // "Employee change approvals"). Same rule as a sale: keys and data, never
  // a sentence — the Admin's own phone renders it in their language.
  CHANGE_REQUEST_TITLE: "push.changeRequest.title",
  CHANGE_REQUEST_BODY: "push.changeRequest.body",
} as const;

/** Discriminates the payload so future notification kinds can share the worker. */
export const PUSH_PAYLOAD_TYPES = { SALE: "sale", CHANGE_REQUEST: "changeRequest" } as const;

/**
 * Whose devices are told about a new change request: the people who can
 * actually decide it. Mirrors who holds changeRequest.approve — a
 * notification nobody in the list can act on is only noise.
 */
export const CHANGE_REQUEST_NOTIFICATION_ROLES = ["ADMIN"] as const;

/**
 * Bounds on what a client may register. An endpoint is a URL from the
 * browser's push service and the keys are fixed-length base64url, so these
 * are sanity limits, not opinions.
 */
export const PUSH_LIMITS = {
  maxEndpointLength: 2048,
  maxKeyLength: 255,
  maxLocaleLength: 10,
  maxUserAgentLength: 512,
} as const;
