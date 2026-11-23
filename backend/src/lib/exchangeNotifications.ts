import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { isPushConfigured, sendPushToTargets } from "@/lib/push";
import { formatMoney } from "@/lib/money";
import {
  EXCHANGE_NOTIFICATION_ROLES,
  EXCHANGE_NOTIFICATION_TRIGGER_ROLES,
  MAX_PUSH_RECIPIENTS,
  PUSH_MESSAGE_KEYS,
  PUSH_PAYLOAD_TYPES,
  SETTINGS_SINGLETON_ID,
} from "@/constants";
import type { PushTarget } from "@/types";
import type { ExchangeNotificationPayload } from "@store/shared/types/push";

// Tells Admins and Managers that someone swapped pieces: after commit, never failing the exchange, keys not sentences.

export interface NotifiableExchange {
  orderId: string;
  orderNumber: number;
  originalOrderNumber: number;
  // Signed: positive = the customer owed the shop.
  difference: string;
  settlement: string;
  staffName: string;
}

interface ExchangeActor {
  id: string;
  role: Role | string;
}

async function findTargets(excludeUserId: string): Promise<PushTarget[]> {
  return prisma.pushSubscription.findMany({
    where: {
      user: {
        role: { in: [...EXCHANGE_NOTIFICATION_ROLES] as Role[] },
        isActive: true,
        id: { not: excludeUserId },
      },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PUSH_RECIPIENTS,
  });
}

/** Exported for tests; the route does not await it. */
export async function sendExchangeNotification(exchange: NotifiableExchange, actor: ExchangeActor): Promise<void> {
  if (!(EXCHANGE_NOTIFICATION_TRIGGER_ROLES as readonly string[]).includes(String(actor.role))) {
    return;
  }
  if (!isPushConfigured()) {
    return;
  }
  const targets = await findTargets(actor.id);
  if (targets.length === 0) {
    return;
  }
  const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
  if (!setting) {
    return;
  }

  const difference = formatMoney(exchange.difference.replace("-", "")) ?? "0";
  await sendPushToTargets(targets, (target): ExchangeNotificationPayload => ({
    type: PUSH_PAYLOAD_TYPES.EXCHANGE,
    titleKey: PUSH_MESSAGE_KEYS.EXCHANGE_TITLE,
    bodyKey: PUSH_MESSAGE_KEYS.EXCHANGE_BODY,
    orderId: exchange.orderId,
    orderNumber: exchange.orderNumber,
    originalOrderNumber: exchange.originalOrderNumber,
    difference,
    // Currency from the Setting singleton (rule 14); the worker formats the amount.
    currency: setting.currency,
    settlement: exchange.settlement,
    staffName: exchange.staffName,
    locale: target.locale,
    defaultLanguage: setting.defaultLanguage,
  }));
}

/** Fire-and-forget: a failed push goes to error tracking, never into the exchange (rule 20). */
export function scheduleExchangeNotification(exchange: NotifiableExchange, actor: ExchangeActor): void {
  void sendExchangeNotification(exchange, actor).catch((error) => {
    captureException(error, { scope: "exchangeNotification", orderId: exchange.orderId });
  });
}
