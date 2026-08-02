import type { Setting } from "@shared/types/setting";
import { apiFetch } from "@/lib/api/client";

export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}
