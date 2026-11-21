import "dotenv/config";
import webpush, { WebPushError } from "web-push";
import { prisma } from "@/lib/prisma";
import { captureException } from "@/lib/logger";
import { PUSH_ENV_KEYS, PUSH_GONE_STATUS_CODES, PUSH_TTL_SECONDS } from "@/constants";
import type { PushDeliveryReport, PushOutcome, PushTarget } from "@/types";

// Web Push transport (VAPID, no third-party provider); the only place that talks to web-push.

const publicKey = process.env[PUSH_ENV_KEYS.PUBLIC_KEY]?.trim();
const privateKey = process.env[PUSH_ENV_KEYS.PRIVATE_KEY]?.trim();
// The contact the push service can complain to.
const subject = process.env[PUSH_ENV_KEYS.SUBJECT]?.trim() || process.env.BETTER_AUTH_URL?.trim();

let configured = false;

if (publicKey && privateKey && subject) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    // Malformed keys: notifications stay off instead of throwing on every sale, and the deployment is told why.
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
  return error instanceof WebPushError && (PUSH_GONE_STATUS_CODES as readonly number[]).includes(error.statusCode);
}

/** Pushes one payload to one device, recording the attempt; a 404/410 subscription is deleted here. */
async function sendToTarget(target: PushTarget, payload: unknown): Promise<PushOutcome> {
  const attemptedAt = new Date();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: PUSH_TTL_SECONDS },
    );
    await touch(target.id, { lastAttemptAt: attemptedAt, lastSuccessAt: attemptedAt });
    return "sent";
  } catch (error) {
    if (isGone(error)) {
      // deleteMany, not delete: the row may already be gone.
      await prisma.pushSubscription.deleteMany({ where: { id: target.id } }).catch(() => undefined);
      return "gone";
    }
    await touch(target.id, { lastAttemptAt: attemptedAt });
    captureException(error, { scope: "push.send", subscriptionId: target.id });
    return "failed";
  }
}

// A subscription can vanish mid-send, so this must never throw.
async function touch(id: string, data: { lastAttemptAt: Date; lastSuccessAt?: Date }): Promise<void> {
  await prisma.pushSubscription.updateMany({ where: { id }, data }).catch(() => undefined);
}

/** Fans out concurrently, one payload per device in its owner's language; never rejects. */
export async function sendPushToTargets(
  targets: PushTarget[],
  buildPayload: (target: PushTarget) => unknown,
): Promise<PushDeliveryReport> {
  const report: PushDeliveryReport = { sent: 0, gone: 0, failed: 0 };
  if (!configured || targets.length === 0) {
    return report;
  }

  const outcomes = await Promise.all(targets.map((target) => sendToTarget(target, buildPayload(target))));
  for (const outcome of outcomes) {
    report[outcome] += 1;
  }
  return report;
}
