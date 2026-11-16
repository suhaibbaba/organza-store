import type { PushConfig, PushSubscriptionDto } from "@organza/shared/types/push";
import type { PushSubscribeInput, PushUnsubscribeInput } from "@organza/shared/schemas/push";
import { apiFetch } from "@/lib/api/client";

// Web Push device registry — always the signed-in user's own devices.

export async function fetchPushConfig(): Promise<PushConfig> {
  const { data } = await apiFetch<PushConfig>("/api/push/config");
  return data;
}

export async function subscribeToPush(input: PushSubscribeInput): Promise<PushSubscriptionDto> {
  const { data } = await apiFetch<PushSubscriptionDto>("/api/push/subscriptions", { method: "POST", body: input });
  return data;
}

export async function unsubscribeFromPush(input: PushUnsubscribeInput): Promise<void> {
  await apiFetch<{ endpoint: string }>("/api/push/subscriptions", { method: "DELETE", body: input });
}
