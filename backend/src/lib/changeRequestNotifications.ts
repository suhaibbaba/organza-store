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
import type { ChangeRequestNotificationPayload } from "@store/shared/types/push";

// Tells the deciders someone is waiting: after the request is filed, never failing it, keys not sentences, bounded.

/** The little of a request this needs. */
export interface NotifiableChangeRequest {
  id: string;
  entityType: string;
  field: string;
  entityLabel: unknown;
  productLabel: unknown;
  requestedById: string;
  requestedBy?: { name: string } | null;
}

/** Every device of someone who can act on this, except the asker's own; bounded (rule 15). */
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
  locale: string | null,
): ChangeRequestNotificationPayload {
  return {
    type: PUSH_PAYLOAD_TYPES.CHANGE_REQUEST,
    titleKey: PUSH_MESSAGE_KEYS.CHANGE_REQUEST_TITLE,
    bodyKey: PUSH_MESSAGE_KEYS.CHANGE_REQUEST_BODY,
    changeRequestId: request.id,
    entityType: request.entityType,
    field: request.field,
    entityLabel: (request.entityLabel ?? null) as I18n | null,
    // Named like the approval card, the piece first; null on an expense, whose entityLabel is the category.
    productLabel: (request.productLabel ?? null) as I18n | null,
    staffName,
    pendingCount,
    locale,
    defaultLanguage,
  };
}

/** Do the work: gather, count, send. Exported so a caller can await it. */
export async function sendChangeRequestNotification(
  request: NotifiableChangeRequest,
  actor: ChangeRequestActorRef,
): Promise<void> {
  // No VAPID keys, nothing to send: the flow stays silent until they are configured.
  if (!isPushConfigured()) {
    return;
  }

  const targets = await findApproverTargets(actor.id);
  if (targets.length === 0) {
    return;
  }

  const [setting, pendingCount] = await Promise.all([
    prisma.setting.findUnique({ where: { id: SETTINGS_SINGLETON_ID } }),
    prisma.changeRequest.count({ where: { status: PENDING_CHANGE_REQUEST_STATUS as never } }),
  ]);
  // No settings row means an unset shop: the request is still filed, but there is no language to render in.
  if (!setting) {
    return;
  }

  const staffName = request.requestedBy?.name ?? "";
  await sendPushToTargets(targets, (target) =>
    buildPayload(request, setting.defaultLanguage, staffName, pendingCount, target.locale),
  );
}

/** Fire-and-forget: a failed push goes to error tracking, never into the filing response (rule 20). */
export function scheduleChangeRequestNotification(request: AnyRecord, actor: ChangeRequestActorRef): void {
  void sendChangeRequestNotification(request as NotifiableChangeRequest, actor).catch((error) => {
    captureException(error, { scope: "changeRequestNotification", changeRequestId: request?.id });
  });
}
