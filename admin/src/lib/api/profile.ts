import type { Profile, ProfileSession } from "@organza/shared/types/profile";
import type { ChangePasswordInput, UpdateProfileInput } from "@organza/shared/schemas/profile";
import { apiFetch } from "@/lib/api/client";

export async function fetchProfile(): Promise<Profile> {
  const { data } = await apiFetch<Profile>("/api/me");
  return data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const { data } = await apiFetch<Profile>("/api/me", { method: "PATCH", body: input });
  return data;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await apiFetch("/api/me/password", { method: "POST", body: input });
}

export async function fetchProfileSessions(): Promise<ProfileSession[]> {
  const { data } = await apiFetch<ProfileSession[]>("/api/me/sessions");
  return data;
}

export async function revokeProfileSession(id: string): Promise<void> {
  await apiFetch(`/api/me/sessions/${id}`, { method: "DELETE" });
}

export async function revokeOtherProfileSessions(): Promise<void> {
  await apiFetch("/api/me/sessions", { method: "DELETE" });
}
