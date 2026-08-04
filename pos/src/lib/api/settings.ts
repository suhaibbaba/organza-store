import type { Setting } from "@shared/types/setting";
import { apiFetch } from "@/lib/api/client";

// Read-only here: the currency every price on this screen is formatted with
// comes from the Setting singleton (CLAUDE.md rule 14). Editing it is an
// Admin job, in the admin app.
export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}
