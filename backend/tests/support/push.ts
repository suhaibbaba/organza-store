// Test devices push to `.invalid` (never resolves), proving a dead push is harmless; lastAttemptAt makes the attempt observable.
import { createECDH, randomBytes } from "node:crypto";
import { apiRequest, uniqueId } from "@tests/support/client";
import { PUSH_ATTEMPT_POLL_INTERVAL_MS, PUSH_ATTEMPT_TIMEOUT_MS } from "@tests/constants";
import type { PushSubscriptionDto } from "@store/shared/types/push";

export interface FakeDevice {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Shaped like a browser subscription, so the send fails at the network, not the crypto. */
export function fakeDevice(): FakeDevice {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://push-${uniqueId()}.store.invalid/subscription`,
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
    body: { endpoint: device.endpoint, keys: device.keys, locale, userAgent: "store-api-test" },
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

/** Sending is fire-and-forget after the response, so this polls. */
export async function waitForAttempt(token: string, device: FakeDevice, since: string | null): Promise<string | null> {
  const deadline = Date.now() + PUSH_ATTEMPT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = await readDevice(token, device);
    if (current && current.lastAttemptAt !== since) {
      return current.lastAttemptAt;
    }
    await sleep(PUSH_ATTEMPT_POLL_INTERVAL_MS);
  }
  return null;
}

/** Waits out a notification that must not appear; callers pair it with one that must. */
export async function settleQuietly(): Promise<void> {
  await sleep(PUSH_ATTEMPT_TIMEOUT_MS);
}
