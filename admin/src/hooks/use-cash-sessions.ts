"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloseCashSessionInput, OpenCashSessionInput } from "@shared/schemas/cash";
import { CASH_SESSION_CURRENT_QUERY_KEY, CASH_SESSION_STALE_TIME_MS } from "@/constants/dashboard";
import { closeCashSession, fetchCurrentCashSession, openCashSession } from "@/lib/api/cash-sessions";

export function useCurrentCashSessionQuery() {
  return useQuery({
    queryKey: CASH_SESSION_CURRENT_QUERY_KEY,
    queryFn: fetchCurrentCashSession,
    staleTime: CASH_SESSION_STALE_TIME_MS,
  });
}

export function useOpenCashSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenCashSessionInput) => openCashSession(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
    },
  });
}

// Closing rejects an unexplained difference (400
// error.cashSession.difference_note_required) — that refusal is part of the
// blind-count flow, not a failure, so the caller handles it rather than this
// hook. Nothing is invalidated on that path because nothing was written.
export function useCloseCashSessionMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseCashSessionInput) => closeCashSession(sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
    },
  });
}
