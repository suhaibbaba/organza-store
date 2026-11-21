"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { can } from "@store/shared/lib/permissions";
import { CHANGE_REQUEST_ENTITIES } from "@store/shared/constants/changeRequest";
import {
  CHANGE_REQUEST_COUNT_QUERY_KEY,
  CHANGE_REQUEST_COUNT_REFETCH_MS,
  CHANGE_REQUEST_LIST_PAGE_SIZE,
  CHANGE_REQUEST_LIST_QUERY_KEY,
} from "@/constants/changeRequests";
import {
  approveChangeRequest,
  cancelChangeRequest,
  fetchChangeRequestCount,
  fetchChangeRequests,
  rejectChangeRequest,
} from "@/lib/api/change-requests";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import { useSession } from "@/components/providers/session-provider";
import type { ChangeRequestListFilters } from "@/types/changeRequest";

export function useChangeRequestsQuery(filters: ChangeRequestListFilters) {
  return useQuery({
    queryKey: [CHANGE_REQUEST_LIST_QUERY_KEY, filters],
    queryFn: () => fetchChangeRequests(filters, CHANGE_REQUEST_LIST_PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
}

// Asked only by someone who may read requests; the backend decides whose are counted.
export function useChangeRequestCountQuery() {
  const { user } = useSession();
  return useQuery({
    queryKey: CHANGE_REQUEST_COUNT_QUERY_KEY,
    queryFn: fetchChangeRequestCount,
    enabled: can(user, "changeRequest.view"),
    refetchInterval: CHANGE_REQUEST_COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

// Approving applies the change, so everything it could touch is stale.
export function useDecideChangeRequestMutation() {
  const queryClient = useQueryClient();
  const { productChanged, expensesChanged } = useCacheInvalidation();

  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      decision === "approve" ? approveChangeRequest(id, note) : rejectChangeRequest(id, note),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: [CHANGE_REQUEST_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_COUNT_QUERY_KEY });
      if (request.entityType === CHANGE_REQUEST_ENTITIES.EXPENSE) {
        expensesChanged();
        return;
      }
      productChanged(request.productId ?? undefined);
    },
  });
}

// Nothing changed, but every view showing the request (list, badge, product's pending badges) must forget it.
export function useCancelChangeRequestMutation() {
  const queryClient = useQueryClient();
  const { productChanged } = useCacheInvalidation();

  return useMutation({
    mutationFn: ({ id }: { id: string; productId?: string | null }) => cancelChangeRequest(id),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: [CHANGE_REQUEST_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_COUNT_QUERY_KEY });
      productChanged(variables.productId ?? undefined);
    },
  });
}
