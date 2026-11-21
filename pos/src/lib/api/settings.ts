import type { Setting } from "@store/shared/types/setting";
import { apiFetch } from "@/lib/api/client";

// Read-only: currency comes from the Setting singleton (rule 14); editing it is an Admin job.
export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}
