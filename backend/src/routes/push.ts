import { Router } from "express";
import type { PushSubscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { AppError, sendOk } from "@/lib/response";
import { getPushPublicKey, isPushConfigured } from "@/lib/push";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  type PushSubscribeInput,
  type PushUnsubscribeInput,
} from "@/validation/push";
import { ERROR_CODES } from "@/constants";
import type { PushConfig, PushSubscriptionDto } from "@/types";

// Web Push device registry.
//
// Every route here is about the CALLER'S OWN devices: a session registers
// the phone it is running on, and can unregister it again. There is
// deliberately no permission gate beyond being signed in — managing your own
// device is not a capability the role table has anything to say about, and
// nothing here reads or writes another user's data (the `userId` on every
// query is taken from the session, never from the request body).
//
// Who actually RECEIVES a sale notification is a separate question, decided
// on the sending side (lib/saleNotifications.ts: Admins only).
const router = Router();
router.use(requireAuth);

function serialize(subscription: PushSubscription): PushSubscriptionDto {
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    locale: subscription.locale,
    userAgent: subscription.userAgent,
    lastAttemptAt: subscription.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: subscription.lastSuccessAt?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /api/push/config — the VAPID public key a browser needs to subscribe.
// Public knowledge by design (it is sent to every push service), and useless
// without the private half. `configured: false` lets the admin explain that
// the server has no keys instead of offering a button that cannot work.
// ---------------------------------------------------------------------------
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config: PushConfig = { configured: isPushConfigured(), publicKey: getPushPublicKey() };
    sendOk(res, config);
  })
);

// ---------------------------------------------------------------------------
// GET /api/push/subscriptions — the caller's own registered devices.
// Naturally bounded: this is one person's handful of phones, not a list
// anyone can page through.
// ---------------------------------------------------------------------------
router.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "asc" },
    });
    sendOk(res, subscriptions.map(serialize));
  })
);

// ---------------------------------------------------------------------------
// POST /api/push/subscriptions — register (or re-register) this device.
//
// Upsert on the endpoint, because the endpoint IS the device: a browser
// hands back the same subscription every time until it is revoked, and the
// same phone may later be signed in to by someone else — in which case the
// row moves to them rather than notifying the previous owner on a device
// they no longer hold.
// ---------------------------------------------------------------------------
router.post(
  "/subscriptions",
  validateBody(pushSubscribeSchema),
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) throw new AppError(503, ERROR_CODES.PUSH_NOT_CONFIGURED);

    const body = req.body as PushSubscribeInput;
    const data = {
      userId: req.user!.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      locale: body.locale ?? null,
      userAgent: body.userAgent ?? null,
    };

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      // A re-subscribe also clears the delivery history: new owner, new keys,
      // a clean slate for "has this device ever accepted anything".
      update: { ...data, lastAttemptAt: null, lastSuccessAt: null },
      create: { ...data, endpoint: body.endpoint },
    });

    sendOk(res, serialize(subscription), null, 201);
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/push/subscriptions — turn notifications off for this device.
// Scoped to the caller: you can only ever remove your own registration.
// ---------------------------------------------------------------------------
router.delete(
  "/subscriptions",
  validateBody(pushUnsubscribeSchema),
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body as PushUnsubscribeInput;

    const deleted = await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user!.id },
    });
    if (deleted.count === 0) throw new AppError(404, ERROR_CODES.PUSH_SUBSCRIPTION_NOT_FOUND);

    sendOk(res, { endpoint });
  })
);

export default router;
