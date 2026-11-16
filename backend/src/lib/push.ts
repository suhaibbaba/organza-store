import "dotenv/config";
import webpush, { WebPushError } from "web-push";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { PUSH_ENV_KEYS, PUSH_GONE_STATUS_CODES, PUSH_TTL_SECONDS } from "@/constants";
import type { PushDeliveryReport, PushOutcome, PushTarget } from "@/types";

// Web Push transport. The standard itself is free — the browser's own push
// service does the delivery — so there is no third-party notification
// provider here, only a VAPID key pair identifying this server.
//
// This module is the ONLY place that talks to `web-push`, and the only place
// that knows a subscription can die. What is worth notifying about lives in
// lib/saleNotifications.ts.

const publicKey = process.env[PUSH_ENV_KEYS.PUBLIC_KEY]?.trim();
const privateKey = process.env[PUSH_ENV_KEYS.PRIVATE_KEY]?.trim();
// The contact the push service can complain to. A VAPID subject must be a
// mailto: or https: URL; the API's own base URL is a sensible default.
const subject = process.env[PUSH_ENV_KEYS.SUBJECT]?.trim() || process.env.BETTER_AUTH_URL?.trim();

let configured = false;

if (publicKey && privateKey && subject) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    // Malformed keys in the environment. Notifications stay off rather than
    // throwing on every sale, and the deployment gets a report saying why.
    captureException(error, { scope: "push.setVapidDetails" });
  }
}

/** False when the deployment has no VAPID keys — every send then no-ops. */
export function isPushConfigured(): boolean {
  return configured;
}

/** The key a browser needs to create a subscription for this server. */
export function getPushPublicKey(): string | null {
  return configured ? (publicKey ?? null) : null;
}

function isGone(error: unknown): boolean {
  return (
    error instanceof WebPushError &&
    (PUSH_GONE_STATUS_CODES as readonly number[]).includes(error.statusCode)
  );
}

/**
 * Push one payload at one device.
 *
 * Records the attempt either way: a device that is written to constantly and
 * never accepts anything is exactly what a broken subscription looks like,
 * and that is only visible if failures are recorded too. A dead subscription
 * (404/410 from the push service) is deleted here — that is the whole of the
 * expired-subscription cleanup, done at the only moment we actually learn
 * about it.
 */
async function sendToTarget(target: PushTarget, payload: unknown): Promise<PushOutcome> {
  const attemptedAt = new Date();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: PUSH_TTL_SECONDS }
    );
    await touch(target.id, { lastAttemptAt: attemptedAt, lastSuccessAt: attemptedAt });
    return "sent";
  } catch (error) {
    if (isGone(error)) {
      // deleteMany, not delete: the row may already have gone (the same
      // device unsubscribing from the app), and that must not raise.
      await prisma.pushSubscription.deleteMany({ where: { id: target.id } }).catch(() => undefined);
      return "gone";
    }
    await touch(target.id, { lastAttemptAt: attemptedAt });
    captureException(error, { scope: "push.send", subscriptionId: target.id });
    return "failed";
  }
}

// A subscription can be deleted between being read and being written to
// (the owner taps "turn off" mid-send), so this must never be the thing that
// throws.
async function touch(id: string, data: { lastAttemptAt: Date; lastSuccessAt?: Date }): Promise<void> {
  await prisma.pushSubscription.updateMany({ where: { id }, data }).catch(() => undefined);
}

/**
 * Fan a notification out to every given device, concurrently. The payload is
 * built per device rather than once, because each device carries the
 * language its owner reads.
 *
 * Never rejects: the caller is a sale that has already been committed, and
 * no push failure may reach it (see lib/saleNotifications.ts).
 */
export async function sendPushToTargets(
  targets: PushTarget[],
  buildPayload: (target: PushTarget) => unknown
): Promise<PushDeliveryReport> {
  const report: PushDeliveryReport = { sent: 0, gone: 0, failed: 0 };
  if (!configured || targets.length === 0) return report;

  const outcomes = await Promise.all(targets.map((target) => sendToTarget(target, buildPayload(target))));
  for (const outcome of outcomes) report[outcome] += 1;
  return report;
}
