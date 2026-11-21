import type { CashSession, CurrentCashSession } from "@store/shared/types/cash";
import type { CloseCashSessionInput, OpenCashSessionInput } from "@store/shared/schemas/cash";
import { apiFetch } from "@/lib/api/client";

// Admin/Manager only; the backend is the gate.

export async function fetchCurrentCashSession(): Promise<CurrentCashSession> {
  const { data } = await apiFetch<CurrentCashSession>("/api/cash-sessions/current");
  return data;
}

export async function openCashSession(input: OpenCashSessionInput): Promise<CashSession> {
  const { data } = await apiFetch<CashSession>("/api/cash-sessions", { method: "POST", body: input });
  return data;
}

// A 400 difference_note_required carries expected/counted/difference, which the blind-count screen reveals.
export async function closeCashSession(id: string, input: CloseCashSessionInput): Promise<CashSession> {
  const { data } = await apiFetch<CashSession>(`/api/cash-sessions/${id}/close`, {
    method: "POST",
    body: input,
  });
  return data;
}
