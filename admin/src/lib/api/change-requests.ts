import type { ChangeRequest, ChangeRequestCancelled, ChangeRequestCount } from "@store/shared/types/changeRequest";
import type { Pagination } from "@store/shared/types/common";
import { apiFetch } from "@/lib/api/client";
import type { ChangeRequestListFilters } from "@/types/changeRequest";

// No create here: a request is born from the action it stands in for.

function buildListQuery(filters: ChangeRequestListFilters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));
  params.set("status", filters.status);
  return params.toString();
}

export async function fetchChangeRequests(
  filters: ChangeRequestListFilters,
  pageSize: number,
): Promise<{ items: ChangeRequest[]; meta: Pagination | null }> {
  const { data, meta } = await apiFetch<ChangeRequest[]>(`/api/change-requests?${buildListQuery(filters, pageSize)}`);
  return { items: data, meta };
}

// Scoped by the backend: everyone's for an Admin, only your own otherwise.
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

// Withdraws your own still-waiting request; the backend checks both conditions.
export async function cancelChangeRequest(id: string): Promise<ChangeRequestCancelled> {
  const { data } = await apiFetch<ChangeRequestCancelled>(`/api/change-requests/${id}/cancel`, {
    method: "POST",
    body: {},
  });
  return data;
}
