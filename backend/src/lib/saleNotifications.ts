import { Role, type Setting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { isPushConfigured, sendPushToTargets } from "@/lib/push";
import { formatMoney } from "@/lib/money";
import {
  MAX_NOTIFICATION_ITEM_NAMES,
  MAX_PUSH_RECIPIENTS,
  PUSH_MESSAGE_KEYS,
  PUSH_PAYLOAD_TYPES,
  SALE_NOTIFICATION_TRIGGER_ROLES,
  SETTINGS_SINGLETON_ID,
} from "@/constants";
import type { AnyRecord, I18n, PushTarget, SaleNotificationPayload } from "@/types";

// Tells Admins about someone else's sale: after commit, never failing it, keys not sentences.

/** The little of an order this needs — deliberately not the route's include type. */
export interface SaleNotificationOrder {
  id: string;
  orderNumber: number;
  total: unknown;
  items: { name: unknown; quantity: number }[];
  createdById: string;
  createdBy: { name: string } | null;
}

export interface SaleActor {
  id: string;
  role: Role | string;
}

/** Whether this sale warrants a notification per the shop's settings; new modes are a case here. */
export function shouldNotifyForSale(
  setting: Pick<Setting, "saleNotificationsEnabled" | "saleNotificationMode" | "saleNotificationMinAmount">,
  total: string,
): boolean {
  if (!setting.saleNotificationsEnabled) {
    return false;
  }

  switch (setting.saleNotificationMode) {
    case "EVERY_SALE":
      return true;
    case "ABOVE_AMOUNT":
      // Reads a stored threshold not yet selectable in settings.
      return Number(total) >= Number(setting.saleNotificationMinAmount);
    case "PERIODIC_SUMMARY":
      // A digest is sent by a scheduled job, never by the sale itself.
      return false;
    default:
      return false;
  }
}

/** Sales worth announcing: a Manager's or an Employee's, never an Admin's own. */
export function isNotifiableActor(actor: SaleActor): boolean {
  return (SALE_NOTIFICATION_TRIGGER_ROLES as readonly string[]).includes(String(actor.role));
}

// The item names a phone has room for, plus how many lines were left over.
function summarizeItems(items: { name: unknown }[]): { itemNames: I18n[]; extraItemCount: number } {
  const named = items.slice(0, MAX_NOTIFICATION_ITEM_NAMES).map((item) => item.name as I18n);
  return { itemNames: named, extraItemCount: Math.max(0, items.length - named.length) };
}

function buildPayload(
  order: SaleNotificationOrder,
  setting: Pick<Setting, "currency" | "defaultLanguage">,
  staffName: string,
  locale: string | null,
): SaleNotificationPayload {
  const { itemNames, extraItemCount } = summarizeItems(order.items);
  return {
    type: PUSH_PAYLOAD_TYPES.SALE,
    titleKey: PUSH_MESSAGE_KEYS.SALE_TITLE,
    bodyKey: PUSH_MESSAGE_KEYS.SALE_BODY,
    orderId: order.id,
    orderNumber: order.orderNumber,
    itemNames,
    extraItemCount,
    total: formatMoney((order.total as AnyRecord)?.toString()) ?? "0",
    // Currency from the Setting singleton (rule 14); the worker formats the amount.
    currency: setting.currency,
    staffName,
    locale,
    defaultLanguage: setting.defaultLanguage,
  };
}

/** Every Admin device except the author's; bounded (rule 15). */
async function findAdminTargets(excludeUserId: string): Promise<PushTarget[]> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { role: Role.ADMIN, isActive: true, id: { not: excludeUserId } },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PUSH_RECIPIENTS,
  });
  return subscriptions;
}

/** Decide, gather, send — exported for tests; the sale path does not await it. */
export async function sendSaleNotification(order: SaleNotificationOrder, actor: SaleActor): Promise<void> {
  if (!isNotifiableActor(actor)) {
    return;
  }
  // Nothing to send with, so nothing to look up either.
  if (!isPushConfigured()) {
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
  // No settings row means an unset shop: the sale is fine, nobody to tell.
  if (!setting) {
    return;
  }

  const total = formatMoney((order.total as AnyRecord)?.toString()) ?? "0";
  if (!shouldNotifyForSale(setting, total)) {
    return;
  }

  const targets = await findAdminTargets(actor.id);
  if (targets.length === 0) {
    return;
  }

  const staffName = order.createdBy?.name ?? "";
  await sendPushToTargets(targets, (target) => buildPayload(order, setting, staffName, target.locale));
}

/** Fire-and-forget for the order route: errors go to error tracking, never to the sale (rule 20). */
export function scheduleSaleNotification(order: SaleNotificationOrder, actor: SaleActor): void {
  void sendSaleNotification(order, actor).catch((error) => {
    captureException(error, { scope: "saleNotification", orderId: order.id });
  });
}
