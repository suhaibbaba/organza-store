"use client";

import { useTranslations } from "next-intl";
import { can } from "@organza/shared/lib/permissions";
import { DEFAULT_PAGE } from "@organza/shared/constants/pagination";
import type { ChangeRequestStatus } from "@organza/shared/types/changeRequest";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { Tabs } from "@store/ui";
import { toSelectorName } from "@organza/shared/lib/testSelector";
import {
  CHANGE_REQUEST_STATUS_TABS,
  CHANGE_REQUEST_LIST_URL_PARAMS,
  DEFAULT_CHANGE_REQUEST_FILTERS,
} from "@/constants/changeRequests";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useChangeRequestsQuery } from "@/hooks/use-change-requests";
import { isQuickSoldRequest } from "@/lib/change-requests";
import { ChangeRequestCard } from "@/components/change-requests/change-request-card";
import { QuickSoldCard } from "@/components/change-requests/quick-sold-card";
import { ChangeRequestPagination } from "@/components/change-requests/change-request-pagination";
import {
  ChangeRequestListEmpty,
  ChangeRequestListError,
  ChangeRequestListLoading,
  ChangeRequestListSpinnerOverlay,
} from "@/components/change-requests/change-request-list-states";

// Approvals: guarded by .view, not .approve, so an Employee can follow their own request (the backend scopes what each sees).
export default function ChangeRequestsPage() {
  return (
    <RoleGuard action="changeRequest.view">
      <ChangeRequestsPageContent />
    </RoleGuard>
  );
}

function ChangeRequestsPageContent() {
  const t = useTranslations("changeRequests");
  const { user } = useSession();
  const canDecide = can(user, "changeRequest.approve");
  // Completing a quick sale is its own permission (review after the sale), separate from approving a change (rule 23).
  const canComplete = can(user, "product.complete");

  const [filters, setFilters] = useUrlFilters(DEFAULT_CHANGE_REQUEST_FILTERS, CHANGE_REQUEST_LIST_URL_PARAMS);
  const { data, isLoading, isFetching, isError, error, refetch } = useChangeRequestsQuery(filters);
  const items = data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader name="change-requests" title={t("title")} description={canDecide ? t("subtitle") : t("subtitleOwn")} />

      <div className="flex flex-col gap-4">
        {/* Tab ids are the selector spelling (tab-pending), mapped back to the status. */}
        <Tabs
          data-testid="tab"
          label="changeRequests.title"
          tabs={CHANGE_REQUEST_STATUS_TABS.map((status) => ({
            id: toSelectorName(status),
            label: `changeRequests.status.${status}`,
          }))}
          value={toSelectorName(filters.status)}
          onChange={(id) => {
            const status = CHANGE_REQUEST_STATUS_TABS.find((value) => toSelectorName(value) === id);
            if (status) setFilters({ status: status as ChangeRequestStatus, page: DEFAULT_PAGE });
          }}
        />

        {isLoading ? (
          <ChangeRequestListLoading />
        ) : isError ? (
          <ChangeRequestListError error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <ChangeRequestListEmpty status={filters.status} />
        ) : (
          <>
            {isFetching && <ChangeRequestListSpinnerOverlay />}
            {/* items-start: a card with its refusal note open doesn't stretch its neighbour. */}
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {items.map((request) =>
                // A quick sale reads "complete its details", never "approve", so it has its own card.
                isQuickSoldRequest(request) ? (
                  <QuickSoldCard key={request.id} request={request} canDecide={canComplete} />
                ) : (
                  <ChangeRequestCard key={request.id} request={request} canDecide={canDecide} />
                )
              )}
            </div>
            {data?.meta && (
              <ChangeRequestPagination
                meta={data.meta}
                onPageChange={(page) => setFilters({ page })}
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
