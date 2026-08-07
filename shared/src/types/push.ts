import type { I18n } from "@/types/common";
import type { PUSH_PAYLOAD_TYPES, SALE_NOTIFICATION_MODES } from "@/constants/push";

export type SaleNotificationMode = (typeof SALE_NOTIFICATION_MODES)[number];
export type PushPayloadType = (typeof PUSH_PAYLOAD_TYPES)[keyof typeof PUSH_PAYLOAD_TYPES];

/**
 * One registered device (GET /api/push/subscriptions — always the caller's
 * own). The endpoint is echoed back because it is how the browser identifies
 * its own subscription; it was supplied by that same browser in the first
 * place, so nothing is disclosed by returning it.
 */
export interface PushSubscriptionDto {
  id: string;
  endpoint: string;
  locale: string | null;
  userAgent: string | null;
  /** Last time a notification was pushed at this device. */
  lastAttemptAt: string | null;
  /** Last time the push service accepted one. */
  lastSuccessAt: string | null;
  createdAt: string;
}

/**
 * GET /api/push/config — what a client needs before it can subscribe.
 * `configured` is false when the server has no VAPID keys in its environment,
 * in which case the admin explains that instead of offering a dead button.
 */
export interface PushConfig {
  configured: boolean;
  publicKey: string | null;
}

/**
 * The push payload itself. Deliberately data, not prose: `titleKey`/`bodyKey`
 * are translation keys (CLAUDE.md rule 12) and the service worker renders
 * them, so the notification arrives in whichever language the device asked
 * for and no sentence is ever hard-coded in the API.
 */
/**
 * A change somebody has asked for and cannot make themselves (spec.md
 * "Employee change approvals"). Same shape of thinking as the sale payload:
 * keys plus data, so the Admin's phone renders it in their own language and
 * tapping it opens the approval screen.
 */
export interface ChangeRequestNotificationPayload {
  type: PushPayloadType;
  titleKey: string;
  bodyKey: string;
  changeRequestId: string;
  /** What is being changed — rendered through t(), never worded here. */
  entityType: string;
  field: string;
  /** The affected thing's name, still translatable. */
  entityLabel: I18n | null;
  /** The owning product's name, preferred over entityLabel when present. */
  productLabel: I18n | null;
  /** Who asked. */
  staffName: string;
  /** How many requests are waiting in total, so the phone can show the queue. */
  pendingCount: number;
  locale: string | null;
  defaultLanguage: string;
}

export interface SaleNotificationPayload {
  type: PushPayloadType;
  titleKey: string;
  bodyKey: string;
  /** Deep-linked from the notification: tapping opens this order. */
  orderId: string;
  orderNumber: number;
  /** Up to MAX_NOTIFICATION_ITEM_NAMES sold items, still translatable. */
  itemNames: I18n[];
  /** How many further lines the sale had beyond those names. */
  extraItemCount: number;
  /** Order total and the store currency it is in (CLAUDE.md rule 14). */
  total: string;
  currency: string;
  /** Who rang it up. */
  staffName: string;
  /** Language this device asked for, and the store default behind it. */
  locale: string | null;
  defaultLanguage: string;
}
