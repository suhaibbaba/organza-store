import type { Setting } from "@organza/shared/types/setting";
import type { UpdateSettingInput } from "@organza/shared/schemas/setting";
import { apiFetch } from "@/lib/api/client";

export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}

export async function updateSettings(input: UpdateSettingInput): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings", { method: "PATCH", body: input });
  return data;
}

export async function uploadLogo(file: File): Promise<Setting> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiFetch<Setting>("/api/settings/logo", { method: "POST", body: formData });
  return data;
}

export async function removeLogo(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings/logo", { method: "DELETE" });
  return data;
}
