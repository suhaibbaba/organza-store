import type { Setting } from "@shared/types/setting";
import type { UpdateSettingInput } from "@shared/schemas/setting";
import { apiFetch } from "@/lib/api/client";

export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}

export async function updateSettings(input: UpdateSettingInput): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings", { method: "PATCH", body: input });
  return data;
}
