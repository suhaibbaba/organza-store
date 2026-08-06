// Helpers for the generic approval flow (spec.md "Employee change
// approvals"). Every gated change — a price, a manual stock figure, a photo
// deletion, hiding a product, a product's variant set, an Employee's expense —
// files one of these, and an Admin decides it through the same two endpoints.
//
// Like the rest of the suite these run against a LIVE API whose database
// already holds other people's requests, so nothing here asserts a total:
// requests are always looked up by the entity they are about.
import { apiRequest } from "@tests/support/client";
import type { ApiResult } from "@tests/types";
import type { ChangeRequestDto } from "@tests/types/changeRequest";

export function listChangeRequests(token: string, query = ""): Promise<ApiResult<ChangeRequestDto[]>> {
  return apiRequest<ChangeRequestDto[]>(`/api/change-requests${query}`, { token });
}

/**
 * The single request still waiting on one entity's field, or undefined. The
 * pendingKey index guarantees there is never more than one — that IS
 * superseding — so this returning at most one row is part of what the suite
 * is checking.
 */
export async function pendingChangeFor(
  token: string,
  entityType: string,
  entityId: string,
  field?: string
): Promise<ChangeRequestDto | undefined> {
  const res = await listChangeRequests(
    token,
    `?status=PENDING&entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&pageSize=100`
  );
  const rows = res.data ?? [];
  return field ? rows.find((r) => r.field === field) : rows[0];
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

/**
 * Sign off an expense that opened PENDING, the way the shop now does it:
 * find the request it filed and approve that. Replaces the old
 * POST /api/expenses/:id/approve, which no longer exists — there is one
 * approval mechanism, not two.
 */
export async function approveExpense(adminToken: string, expenseId: string): Promise<ApiResult<ChangeRequestDto>> {
  const pending = await pendingChangeFor(adminToken, "Expense", expenseId);
  if (!pending) throw new Error(`No pending change request found for expense ${expenseId}`);
  return approveChange(adminToken, pending.id);
}

export async function rejectExpense(
  adminToken: string,
  expenseId: string,
  note?: string
): Promise<ApiResult<ChangeRequestDto>> {
  const pending = await pendingChangeFor(adminToken, "Expense", expenseId);
  if (!pending) throw new Error(`No pending change request found for expense ${expenseId}`);
  return rejectChange(adminToken, pending.id, note);
}
