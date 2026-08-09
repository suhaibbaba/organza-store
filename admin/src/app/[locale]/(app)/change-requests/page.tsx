"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { can } from "@shared/lib/permissions";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import type { ChangeRequestStatus } from "@shared/types/changeRequest";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHANGE_REQUEST_STATUS_TABS,
  DEFAULT_CHANGE_REQUEST_FILTERS,
} from "@/constants/changeRequests";
import { useChangeRequestsQuery } from "@/hooks/use-change-requests";
import { ChangeRequestCard } from "@/components/change-requests/change-request-card";
import { ChangeRequestPagination } from "@/components/change-requests/change-request-pagination";
import {
  ChangeRequestListEmpty,
  ChangeRequestListError,
  ChangeRequestListLoading,
  ChangeRequestListSpinnerOverlay,
} from "@/components/change-requests/change-request-list-states";
import type { ChangeRequestListFilters } from "@/types/changeRequest";

// The approvals screen (spec.md "Employee change approvals").
//
// Two audiences, one page, decided entirely on the backend: an Admin sees
// everything waiting and can act on it; anybody else sees only what they
// themselves asked for and can only watch it. That is why the guard is
// changeRequest.view rather than .approve — an Employee has to be able to
// follow their own request, or the flow feels like a black hole.
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

  const [filters, setFilters] = useState<ChangeRequestListFilters>(DEFAULT_CHANGE_REQUEST_FILTERS);
  const { data, isLoading, isFetching, isError, error, refetch } = useChangeRequestsQuery(filters);
  const items = data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={canDecide ? t("subtitle") : t("subtitleOwn")} />

      <div className="flex flex-col gap-4">
        <Tabs
          value={filters.status}
          onValueChange={(status) =>
            setFilters({ status: status as ChangeRequestStatus, page: DEFAULT_PAGE })
          }
        >
          {/* Sized to its three labels rather than stretched across the row —
              the triggers keep their 44px height, so they stay big targets
              without a tab strip running the width of a desktop. */}
          <TabsList className="inline-flex w-fit">
            {CHANGE_REQUEST_STATUS_TABS.map((status) => (
              <TabsTrigger key={status} value={status}>
                {t(`status.${status}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <ChangeRequestListLoading />
        ) : isError ? (
          <ChangeRequestListError error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <ChangeRequestListEmpty status={filters.status} />
        ) : (
          <>
            {isFetching && <ChangeRequestListSpinnerOverlay />}
            {/* Decision cards, two across from the large-tablet width up —
                each carries a couple of buttons and a note box, so it wants
                more room than a plain row. `items-start` keeps a card whose
                refusal note is open from stretching the one beside it. */}
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {items.map((request) => (
                <ChangeRequestCard key={request.id} request={request} canDecide={canDecide} />
              ))}
            </div>
            {data?.meta && (
              <ChangeRequestPagination
                meta={data.meta}
                onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
