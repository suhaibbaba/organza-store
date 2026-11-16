import type { DashboardSummary } from "@organza/shared/types/dashboard";
import { apiFetch } from "@/lib/api/client";

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await apiFetch<DashboardSummary>("/api/dashboard/summary");
  return data;
}
