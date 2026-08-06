"use client";

import { useQuery } from "@tanstack/react-query";
import { EXPENSES_PENDING_COUNT_QUERY_KEY, NEEDS_ATTENTION_STALE_TIME_MS } from "@/constants/dashboard";
import { fetchPendingExpenseCount } from "@/lib/api/expenses";

// Expenses waiting to be signed off — one of the three things the dashboard's
// "needs attention" list watches.
export function usePendingExpenseCountQuery() {
  return useQuery({
    queryKey: EXPENSES_PENDING_COUNT_QUERY_KEY,
    queryFn: fetchPendingExpenseCount,
    staleTime: NEEDS_ATTENTION_STALE_TIME_MS,
  });
}
