import type { PushSubscribeInput } from "@shared/schemas/push";
import { SERVICE_WORKER_READY_TIMEOUT_MS } from "@/constants/pwa";

// Browser-side plumbing for Web Push. Kept out of the hook so the hook is
// only about state, and so every "does this browser even do push" question
// has one answer, in one place.

/** Everything push needs, present. Safari on an un-installed iPhone has none of it. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac, so the touch check catches it too.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * The VAPID public key travels as base64url text and has to reach
 * `pushManager.subscribe` as bytes.
 */
function toApplicationServerKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  // Backed by a plain ArrayBuffer on purpose: `applicationServerKey` accepts
  // a BufferSource, which a possibly-shared buffer doesn't satisfy.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Bounded wait — see SERVICE_WORKER_READY_TIMEOUT_MS for why it can't be open-ended. */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("service worker not ready")), SERVICE_WORKER_READY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** This device's existing subscription, if it has one. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Subscribe this device, reusing the browser's existing subscription when it
 * already has one for this server. Re-subscribing under a *different* server
 * key would be rejected by the browser, so a subscription minted for an
 * older key is dropped first — that is what happens when a deployment
 * regenerates its VAPID keys.
 */
export async function createSubscription(publicKey: string, locale: string): Promise<PushSubscribeInput> {
  const registration = await readyRegistration();

  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !hasKey(subscription, publicKey)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({
    // Required by Chrome, and honest: every push this app receives shows a
    // notification.
    userVisibleOnly: true,
    applicationServerKey: toApplicationServerKey(publicKey),
  });

  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    locale: locale as PushSubscribeInput["locale"],
    userAgent: navigator.userAgent,
  };
}

function hasKey(subscription: PushSubscription, publicKey: string): boolean {
  const existing = subscription.options.applicationServerKey;
  if (!existing) return false;
  const wanted = toApplicationServerKey(publicKey);
  const actual = new Uint8Array(existing as ArrayBuffer);
  return actual.length === wanted.length && actual.every((byte, index) => byte === wanted[index]);
}

/** Drop this device's registration in the browser. The API side is the caller's job. */
export async function dropSubscription(): Promise<string | null> {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => undefined);
  return endpoint;
}
