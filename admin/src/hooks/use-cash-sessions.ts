"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloseCashSessionInput, OpenCashSessionInput } from "@store/shared/schemas/cash";
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

// An unexplained difference is refused (difference_note_required) as part of the blind count; the caller handles it.
export function useCloseCashSessionMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseCashSessionInput) => closeCashSession(sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CASH_SESSION_CURRENT_QUERY_KEY });
    },
  });
}
