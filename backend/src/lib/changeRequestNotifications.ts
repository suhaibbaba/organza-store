import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { isPushConfigured, sendPushToTargets } from "@/lib/push";
import {
  CHANGE_REQUEST_NOTIFICATION_ROLES,
  MAX_PUSH_RECIPIENTS,
  PENDING_CHANGE_REQUEST_STATUS,
  PUSH_MESSAGE_KEYS,
  PUSH_PAYLOAD_TYPES,
  SETTINGS_SINGLETON_ID,
} from "@/constants";
import type { AnyRecord, ChangeRequestActorRef, I18n, PushTarget } from "@/types";
import type { ChangeRequestNotificationPayload } from "@shared/types/push";

// Telling the people who can decide that somebody is waiting on them.
//
// Same three rules as the sale notification (lib/saleNotifications.ts), for
// the same reasons:
//   1. The request comes first. This runs after it is filed and can never
//      fail it — hence the fire-and-forget wrapper at the bottom.
//   2. No sentences. Translation keys and data (CLAUDE.md rule 12); the
//      admin's service worker renders them in the reader's own language.
//   3. Nobody is told about their own request.
//
// Only creation notifies, deliberately: a decision is made BY the person who
// would be notified, and the person who asked finds out on the screen where
// they asked (their pending badge simply clears).

/** The little of a request this needs. */
export interface NotifiableChangeRequest {
  id: string;
  entityType: string;
  field: string;
  entityLabel: unknown;
  requestedById: string;
  requestedBy?: { name: string } | null;
}

/**
 * Every device belonging to somebody who can act on this, except the asker's
 * own. Bounded (CLAUDE.md rule 15) for the same reason the sale fan-out is.
 */
async function findApproverTargets(excludeUserId: string): Promise<PushTarget[]> {
  return prisma.pushSubscription.findMany({
    where: {
      user: {
        role: { in: [...CHANGE_REQUEST_NOTIFICATION_ROLES] as Role[] },
        isActive: true,
        id: { not: excludeUserId },
      },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true, locale: true },
    orderBy: { createdAt: "asc" },
    take: MAX_PUSH_RECIPIENTS,
  });
}

function buildPayload(
  request: NotifiableChangeRequest,
  defaultLanguage: string,
  staffName: string,
  pendingCount: number,
  locale: string | null
): ChangeRequestNotificationPayload {
  return {
    type: PUSH_PAYLOAD_TYPES.CHANGE_REQUEST,
    titleKey: PUSH_MESSAGE_KEYS.CHANGE_REQUEST_TITLE,
    bodyKey: PUSH_MESSAGE_KEYS.CHANGE_REQUEST_BODY,
    changeRequestId: request.id,
    entityType: request.entityType,
    field: request.field,
    entityLabel: (request.entityLabel ?? null) as I18n | null,
    staffName,
    pendingCount,
    locale,
    defaultLanguage,
  };
}

/** Do the work: gather, count, send. Exported so a caller can await it. */
export async function sendChangeRequestNotification(
  request: NotifiableChangeRequest,
  actor: ChangeRequestActorRef
): Promise<void> {
  // Nothing to send with, so nothing to look up either. This is also the
  // clean hook the whole feature hangs on: with no VAPID keys configured the
  // flow is unchanged and silent, and configuring them turns it on.
  if (!isPushConfigured()) return;

  const targets = await findApproverTargets(actor.id);
  if (targets.length === 0) return;

  const [setting, pendingCount] = await Promise.all([
    prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } }),
    prisma.changeRequest.count({ where: { status: PENDING_CHANGE_REQUEST_STATUS as never } }),
  ]);
  // No settings row yet means a shop that hasn't been set up; the request is
  // still filed, there is just no default language to render it against.
  if (!setting) return;

  const staffName = request.requestedBy?.name ?? "";
  await sendPushToTargets(targets, (target) =>
    buildPayload(request, setting.defaultLanguage, staffName, pendingCount, target.locale)
  );
}

/**
 * Fire-and-forget wrapper used when a request is filed. Nothing it does can
 * reach the request that triggered it: a push that fails is a failure of the
 * notification, so it ends up in the error-tracking layer instead of in the
 * response (CLAUDE.md rule 20).
 */
export function scheduleChangeRequestNotification(request: AnyRecord, actor: ChangeRequestActorRef): void {
  void sendChangeRequestNotification(request as NotifiableChangeRequest, actor).catch((error) => {
    captureException(error, { scope: "changeRequestNotification", changeRequestId: request?.id });
  });
}
