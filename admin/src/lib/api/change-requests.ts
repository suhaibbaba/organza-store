import type {
  ChangeRequest,
  ChangeRequestCancelled,
  ChangeRequestCount,
} from "@shared/types/changeRequest";
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

/**
 * Taking your OWN ask back, while it is still waiting.
 *
 * Not a decision, so it answers with the id rather than a request: the row is
 * removed and what was asked for lives on in the audit trail. The backend
 * checks both halves — that the caller is the one who asked, and that nobody
 * has answered yet — so nothing here is trusted to have got it right.
 */
export async function cancelChangeRequest(id: string): Promise<ChangeRequestCancelled> {
  const { data } = await apiFetch<ChangeRequestCancelled>(`/api/change-requests/${id}/cancel`, {
    method: "POST",
    body: {},
  });
  return data;
}
