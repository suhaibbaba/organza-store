import type { ChangeRequest, ChangeRequestCount } from "@shared/types/changeRequest";
import type { Pagination } from "@shared/types/common";
import { apiFetch } from "@/lib/api/client";
import type { ChangeRequestListFilters } from "@/types/changeRequest";

// The generic approval gate (spec.md "Employee change approvals"). There is
// deliberately no "create" here: a request is born from the action it stands
// in for — an Employee saving a new price — so the only calls the admin ever
// makes are reading them and deciding them.

function buildListQuery(filters: ChangeRequestListFilters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));
  params.set("status", filters.status);
  return params.toString();
}

export async function fetchChangeRequests(
  filters: ChangeRequestListFilters,
  pageSize: number
): Promise<{ items: ChangeRequest[]; meta: Pagination | null }> {
  const { data, meta } = await apiFetch<ChangeRequest[]>(`/api/change-requests?${buildListQuery(filters, pageSize)}`);
  return { items: data, meta };
}

/**
 * How many are waiting. Scoped by the backend to what the caller can act on:
 * everyone's for an Admin, only their own for anybody else — so the same
 * number means "waiting on you" to one person and "waiting for you" to the
 * other, which is what both of them actually want to know.
 */
export async function fetchChangeRequestCount(): Promise<ChangeRequestCount> {
  const { data } = await apiFetch<ChangeRequestCount>("/api/change-requests/count");
  return data;
}

export async function approveChangeRequest(id: string, note?: string): Promise<ChangeRequest> {
  const { data } = await apiFetch<ChangeRequest>(`/api/change-requests/${id}/approve`, {
    method: "POST",
    body: note ? { note } : {},
  });
  return data;
}

export async function rejectChangeRequest(id: string, note?: string): Promise<ChangeRequest> {
  const { data } = await apiFetch<ChangeRequest>(`/api/change-requests/${id}/reject`, {
    method: "POST",
    body: note ? { note } : {},
  });
  return data;
}
