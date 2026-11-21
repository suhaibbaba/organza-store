import type {
  PushConfig,
  PushPayloadType,
  PushSubscriptionDto,
  SaleNotificationMode,
  SaleNotificationPayload,
} from "@store/shared/types/push";

export type { PushConfig, PushPayloadType, PushSubscriptionDto, SaleNotificationMode, SaleNotificationPayload };

/** A stored device, in the shape the Web Push standard expects it back in. */
export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
}

/** sent: accepted; gone: dead and removed; failed: anything else, subscription kept. */
export type PushOutcome = "sent" | "gone" | "failed";

/** Tally of a fan-out, for the log line and for nothing else. */
export interface PushDeliveryReport {
  sent: number;
  gone: number;
  failed: number;
}
