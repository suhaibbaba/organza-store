import type { AppVersionInfo } from "@store/shared/types/version";
import { apiFetch } from "@/lib/api/client";

// Shown beside the app's own version: a mismatch is usually the diagnosis.
export async function fetchApiVersion(): Promise<AppVersionInfo> {
  const { data } = await apiFetch<AppVersionInfo>("/api/version");
  return data;
}
