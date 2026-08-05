import type { AppVersionInfo } from "@shared/types/version";
import { apiFetch } from "@/lib/api/client";

// Which build of the API is answering (GET /api/version). Shown beside this
// app's own version so a staff member reporting a problem can read out both —
// a mismatch is usually the whole diagnosis.
export async function fetchApiVersion(): Promise<AppVersionInfo> {
  const { data } = await apiFetch<AppVersionInfo>("/api/version");
  return data;
}
