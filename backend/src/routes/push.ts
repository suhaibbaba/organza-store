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

// Web Push device registry: the caller's own devices only, userId always from the session.
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

// GET /api/push/config — the public VAPID key; `configured: false` when the server has no keys.
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config: PushConfig = { configured: isPushConfigured(), publicKey: getPushPublicKey() };
    sendOk(res, config);
  }),
);

// GET /api/push/subscriptions — the caller's own devices, naturally bounded.
router.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "asc" },
    });
    sendOk(res, subscriptions.map(serialize));
  }),
);

// POST /api/push/subscriptions — upsert on the endpoint (it IS the device), moving it to whoever now signs in.
router.post(
  "/subscriptions",
  validateBody(pushSubscribeSchema),
  asyncHandler(async (req, res) => {
    if (!isPushConfigured()) {
      throw new AppError(503, ERROR_CODES.PUSH_NOT_CONFIGURED);
    }

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
      // A re-subscribe clears the delivery history: new owner, new keys.
      update: { ...data, lastAttemptAt: null, lastSuccessAt: null },
      create: { ...data, endpoint: body.endpoint },
    });

    sendOk(res, serialize(subscription), null, 201);
  }),
);

// DELETE /api/push/subscriptions — turn this device off; only your own.
router.delete(
  "/subscriptions",
  validateBody(pushUnsubscribeSchema),
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body as PushUnsubscribeInput;

    const deleted = await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user!.id },
    });
    if (deleted.count === 0) {
      throw new AppError(404, ERROR_CODES.PUSH_SUBSCRIPTION_NOT_FOUND);
    }

    sendOk(res, { endpoint });
  }),
);

export default router;
