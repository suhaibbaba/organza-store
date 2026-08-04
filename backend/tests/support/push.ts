// Helpers for the sale-notification suite.
//
// The devices registered here are deliberately unreachable: the endpoint
// host is under `.invalid`, which by RFC 2606 never resolves. That is the
// point — the shop's own phones can't be enrolled from a test, and a push
// that cannot be delivered is exactly the case the suite has to prove is
// harmless (a sale must succeed regardless).
//
// What IS observable is the attempt: the API records `lastAttemptAt` on the
// subscription whenever it pushes at it (backend/src/lib/push.ts), so
// "were the Admins notified about this sale" can be answered over HTTP.
import { createECDH, randomBytes } from "node:crypto";
import { apiRequest, uniqueId } from "@tests/support/client";
import { PUSH_ATTEMPT_POLL_INTERVAL_MS, PUSH_ATTEMPT_TIMEOUT_MS } from "@tests/constants";
import type { PushSubscriptionDto } from "@shared/types/push";

export interface FakeDevice {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * A subscription shaped exactly like a browser's: a real P-256 public point
 * and a 16-byte auth secret, so the payload genuinely encrypts and the send
 * fails at the network rather than at the crypto — the failure a real dead
 * push service would produce.
 */
export function fakeDevice(): FakeDevice {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://push-${uniqueId()}.organza.invalid/subscription`,
    keys: {
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
}

export async function registerDevice(token: string, device: FakeDevice, locale = "ar") {
  return apiRequest<PushSubscriptionDto>("/api/push/subscriptions", {
    method: "POST",
    token,
    body: { endpoint: device.endpoint, keys: device.keys, locale, userAgent: "organza-api-test" },
  });
}

export async function unregisterDevice(token: string, device: FakeDevice) {
  return apiRequest("/api/push/subscriptions", {
    method: "DELETE",
    token,
    body: { endpoint: device.endpoint },
  });
}

export async function listDevices(token: string): Promise<PushSubscriptionDto[]> {
  const res = await apiRequest<PushSubscriptionDto[]>("/api/push/subscriptions", { token });
  return res.data ?? [];
}

/** This device's registration, or undefined once it has been cleaned up. */
export async function readDevice(token: string, device: FakeDevice): Promise<PushSubscriptionDto | undefined> {
  return (await listDevices(token)).find((entry) => entry.endpoint === device.endpoint);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a notification to be pushed at this device.
 *
 * Sending is fire-and-forget (it happens after the order's response has gone
 * out), so "was it notified" is a question with a delay attached — hence
 * polling rather than a single read.
 */
export async function waitForAttempt(
  token: string,
  device: FakeDevice,
  since: string | null
): Promise<string | null> {
  const deadline = Date.now() + PUSH_ATTEMPT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = await readDevice(token, device);
    if (current && current.lastAttemptAt !== since) return current.lastAttemptAt;
    await sleep(PUSH_ATTEMPT_POLL_INTERVAL_MS);
  }
  return null;
}

/**
 * Gives a notification that must NOT be sent time to fail to appear.
 *
 * Every caller pairs this with a sale that MUST notify, proving the pipeline
 * was awake the whole time — otherwise a slow API would make a "nothing was
 * sent" assertion pass for the wrong reason.
 */
export async function settleQuietly(): Promise<void> {
  await sleep(PUSH_ATTEMPT_TIMEOUT_MS);
}
