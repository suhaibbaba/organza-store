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

// Telling the Admins that someone else has made a sale.
//
// Three rules shape everything below:
//   1. The sale comes first. This runs AFTER the order is committed and its
//      response is on its way out, and it can never fail the sale — hence
//      notifySaleCreated() being fire-and-forget and swallowing everything.
//   2. No sentences. The payload carries translation keys and numbers
//      (CLAUDE.md rule 12); the admin's service worker renders them in the
//      reader's own language.
//   3. Nobody is told about their own sale.

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

/**
 * Whether this sale is worth a notification, per the shop's settings.
 *
 * The switch is the extension point: ABOVE_AMOUNT and PERIODIC_SUMMARY are
 * already in the schema and in the mode enum, so adding either is a case
 * here (plus, for the digest, a scheduled job) rather than a migration and a
 * settings redesign. Until then they are not accepted by the settings API
 * (IMPLEMENTED_SALE_NOTIFICATION_MODES), so an unknown mode can only mean a
 * row written by a newer build — in which case the safe answer is silence.
 */
export function shouldNotifyForSale(
  setting: Pick<Setting, "saleNotificationsEnabled" | "saleNotificationMode" | "saleNotificationMinAmount">,
  total: string
): boolean {
  if (!setting.saleNotificationsEnabled) return false;

  switch (setting.saleNotificationMode) {
    case "EVERY_SALE":
      return true;
    case "ABOVE_AMOUNT":
      // Reads the threshold the shop has already been able to store, but is
      // not yet selectable in settings — see the enum comment above.
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
  locale: string | null
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
    // Currency comes from the Setting singleton, never from a constant
    // (CLAUDE.md rule 14) — the worker formats the amount with it.
    currency: setting.currency,
    staffName,
    locale,
    defaultLanguage: setting.defaultLanguage,
  };
}

/**
 * Every Admin device except the author's own. Bounded (CLAUDE.md rule 15):
 * a shop has a handful of Admins, and a notification must never turn into an
 * unbounded job.
 */
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

/**
 * Do the work: decide, gather, send. Exported for the tests and for any
 * future caller that wants to await it — the sale path does not.
 */
export async function sendSaleNotification(order: SaleNotificationOrder, actor: SaleActor): Promise<void> {
  if (!isNotifiableActor(actor)) return;
  // Nothing to send with, so nothing to look up either.
  if (!isPushConfigured()) return;

  const setting = await prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } });
  // No settings row yet means a shop that hasn't been set up; the sale is
  // still fine, there is just nobody configured to tell.
  if (!setting) return;

  const total = formatMoney((order.total as AnyRecord)?.toString()) ?? "0";
  if (!shouldNotifyForSale(setting, total)) return;

  const targets = await findAdminTargets(actor.id);
  if (targets.length === 0) return;

  const staffName = order.createdBy?.name ?? "";
  await sendPushToTargets(targets, (target) => buildPayload(order, setting, staffName, target.locale));
}

/**
 * Fire-and-forget wrapper used by the order route. Returns immediately, and
 * absolutely nothing it does can reach the sale: a push that fails is a
 * failure of the notification, never of the order that triggered it, so
 * every error ends up in the error-tracking layer instead of in the
 * response (CLAUDE.md rule 20).
 */
export function scheduleSaleNotification(order: SaleNotificationOrder, actor: SaleActor): void {
  void sendSaleNotification(order, actor).catch((error) => {
    captureException(error, { scope: "saleNotification", orderId: order.id });
  });
}
