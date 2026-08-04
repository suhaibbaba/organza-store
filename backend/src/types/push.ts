import type { PushConfig, PushPayloadType, PushSubscriptionDto, SaleNotificationMode, SaleNotificationPayload } from "@shared/types/push";

export type { PushConfig, PushPayloadType, PushSubscriptionDto, SaleNotificationMode, SaleNotificationPayload };

/** A stored device, in the shape the Web Push standard expects it back in. */
export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
}

/**
 * What became of one push.
 *   sent   — the push service accepted it
 *   gone   — the subscription is dead and has been removed
 *   failed — something else went wrong; the subscription is kept
 */
export type PushOutcome = "sent" | "gone" | "failed";

/** Tally of a fan-out, for the log line and for nothing else. */
export interface PushDeliveryReport {
  sent: number;
  gone: number;
  failed: number;
}
