import type { CashSession, CurrentCashSession } from "@organza/shared/types/cash";
import type { CloseCashSessionInput, OpenCashSessionInput } from "@organza/shared/schemas/cash";
import { apiFetch } from "@/lib/api/client";

// The cash drawer (spec.md "Cash drawer & expenses"). Admin/Manager only —
// the backend is the gate; this is just the wire.

export async function fetchCurrentCashSession(): Promise<CurrentCashSession> {
  const { data } = await apiFetch<CurrentCashSession>("/api/cash-sessions/current");
  return data;
}

export async function openCashSession(input: OpenCashSessionInput): Promise<CashSession> {
  const { data } = await apiFetch<CashSession>("/api/cash-sessions", { method: "POST", body: input });
  return data;
}

// Closing is where the count is recorded. It can come back 400 with
// `error.cashSession.difference_note_required` when the count disagrees with
// the books and no explanation was given — the error carries the expected,
// counted and difference figures, which is how the blind-count screen learns
// what to reveal (see close-day-sheet.tsx).
export async function closeCashSession(id: string, input: CloseCashSessionInput): Promise<CashSession> {
  const { data } = await apiFetch<CashSession>(`/api/cash-sessions/${id}/close`, {
    method: "POST",
    body: input,
  });
  return data;
}
