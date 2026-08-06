"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { can } from "@shared/lib/permissions";
import {
  CHANGE_REQUEST_COUNT_QUERY_KEY,
  CHANGE_REQUEST_COUNT_REFETCH_MS,
  CHANGE_REQUEST_LIST_PAGE_SIZE,
  CHANGE_REQUEST_LIST_QUERY_KEY,
} from "@/constants/changeRequests";
import {
  approveChangeRequest,
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

/**
 * The number on the navigation badge.
 *
 * Only asked for by somebody who may read requests at all — otherwise this
 * would be a 403 on every screen. The backend decides WHOSE requests are
 * counted (see lib/api/change-requests.ts), so nothing here needs to know.
 */
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

/**
 * Approving or rejecting. Approving APPLIES the change, so everything that
 * change could be about has to be reconsidered stale — a price, a stock
 * figure, a photo, a product's visibility, its variants, or an expense that
 * has just become real money.
 */
export function useDecideChangeRequestMutation() {
  const queryClient = useQueryClient();
  const { productChanged } = useCacheInvalidation();

  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      decision === "approve" ? approveChangeRequest(id, note) : rejectChangeRequest(id, note),
    onSuccess: (request) => {
      void queryClient.invalidateQueries({ queryKey: [CHANGE_REQUEST_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: CHANGE_REQUEST_COUNT_QUERY_KEY });
      // productId is null for an expense; productChanged() with no id still
      // refreshes the catalogue views, which is the safe answer either way.
      productChanged(request.productId ?? undefined);
    },
  });
}
