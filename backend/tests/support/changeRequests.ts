// Live API with other people's requests, so requests are always looked up by their entity, never counted.
import { apiRequest } from "@tests/support/client";
import type { ApiResult } from "@tests/types";
import type { ChangeRequestDto } from "@tests/types/changeRequest";

export function listChangeRequests(token: string, query = ""): Promise<ApiResult<ChangeRequestDto[]>> {
  return apiRequest<ChangeRequestDto[]>(`/api/change-requests${query}`, { token });
}

/** The one pending request on a field; the pendingKey index guarantees at most one. */
export async function pendingChangeFor(
  token: string,
  entityType: string,
  entityId: string,
  field?: string,
): Promise<ChangeRequestDto | undefined> {
  const res = await listChangeRequests(
    token,
    `?status=PENDING&entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&pageSize=100`,
  );
  const rows = res.data ?? [];
  return field ? rows.find((r) => r.field === field) : rows[0];
}

/** Every request on a field, decided ones too: what "one decision, once" is checked against. */
export async function changeRequestsFor(
  token: string,
  entityType: string,
  entityId: string,
  field?: string,
): Promise<ChangeRequestDto[]> {
  const res = await listChangeRequests(
    token,
    `?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&pageSize=100`,
  );
  const rows = res.data ?? [];
  return field ? rows.filter((r) => r.field === field) : rows;
}

export function approveChange(token: string, id: string, note?: string): Promise<ApiResult<ChangeRequestDto>> {
  return apiRequest<ChangeRequestDto>(`/api/change-requests/${id}/approve`, {
    method: "POST",
    token,
    body: note === undefined ? {} : { note },
  });
}

export function rejectChange(token: string, id: string, note?: string): Promise<ApiResult<ChangeRequestDto>> {
  return apiRequest<ChangeRequestDto>(`/api/change-requests/${id}/reject`, {
    method: "POST",
    token,
    body: note === undefined ? {} : { note },
  });
}

/** Withdrawing your own ask; answers `{ id, cancelled }` because the row is gone. */
export function cancelChange(token: string, id: string): Promise<ApiResult<{ id: string; cancelled: boolean }>> {
  return apiRequest<{ id: string; cancelled: boolean }>(`/api/change-requests/${id}/cancel`, {
    method: "POST",
    token,
    body: {},
  });
}

/** Approves an expense through the request it filed: there is one approval mechanism. */
export async function approveExpense(adminToken: string, expenseId: string): Promise<ApiResult<ChangeRequestDto>> {
  const pending = await pendingChangeFor(adminToken, "Expense", expenseId);
  if (!pending) {
    throw new Error(`No pending change request found for expense ${expenseId}`);
  }
  return approveChange(adminToken, pending.id);
}

export async function rejectExpense(
  adminToken: string,
  expenseId: string,
  note?: string,
): Promise<ApiResult<ChangeRequestDto>> {
  const pending = await pendingChangeFor(adminToken, "Expense", expenseId);
  if (!pending) {
    throw new Error(`No pending change request found for expense ${expenseId}`);
  }
  return rejectChange(adminToken, pending.id, note);
}
