"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { useDashboardSummaryQuery } from "@/hooks/use-dashboard";
import { useCurrentCashSessionQuery } from "@/hooks/use-cash-sessions";
import { useSalesSummaryQuery } from "@/hooks/use-reports";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TodaySection } from "@/components/dashboard/today-section";
import { CashDrawerSection } from "@/components/dashboard/cash-drawer-section";
import { PeriodControls } from "@/components/dashboard/period-controls";
import { PeriodSection } from "@/components/dashboard/period-section";
import { NeedsAttentionSection } from "@/components/dashboard/needs-attention-section";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-states";
import { DEFAULT_DASHBOARD_PERIOD } from "@/constants/dashboard";
import type { ReportPeriod } from "@/types/report";

// The dashboard (spec.md "Cash drawer & expenses" -> Reporting).
//
// Figures only — no chart. The people reading this are standing at a counter
// with a phone in one hand, and what they need is a number they can act on,
// not a trend they have to interpret.
//
// Four sections, always in this order, because it is the order of the day:
// what happened today -> is the drawer right -> how the period is going ->
// what still needs doing.
//
// Admin/Manager only (CLAUDE.md rule 5): /api/dashboard/summary and
// /api/reports/sales-summary both 403 for an Employee. This is also the
// screen everything else points at when it doesn't know the role yet (the
// root redirect, the proxy, the login form), so an Employee landing here
// asked for nothing — the guard sends them on to their own first screen
// rather than telling them off for a redirect they didn't choose.
export default function DashboardPage() {
  return (
    <RoleGuard action="dashboard.view" onDenied="redirect">
      <DashboardPageContent />
    </RoleGuard>
  );
}

function DashboardPageContent() {
  const t = useTranslations("dashboard");
  const { user } = useSession();

  const summaryQuery = useDashboardSummaryQuery();
  const salesQuery = useSalesSummaryQuery();
  const drawerQuery = useCurrentCashSessionQuery();

  // Which window the figures block shows. It lives here rather than inside
  // the block because its control sits in the page header — one request
  // carries all three periods, so switching is still instant.
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_DASHBOARD_PERIOD);

  // The three requests run together and are only judged together: half a
  // dashboard, with one section silently missing, is worse than saying it
  // couldn't be loaded.
  const isLoading = summaryQuery.isLoading || salesQuery.isLoading || drawerQuery.isLoading;
  const error = summaryQuery.error ?? salesQuery.error ?? drawerQuery.error;

  function retry() {
    void summaryQuery.refetch();
    void salesQuery.refetch();
    void drawerQuery.refetch();
  }

  return (
    <PageContainer>
      <PageHeader
        title={user ? t("welcome", { name: user.name }) : t("title")}
        description={t("subtitle")}
        // Only once there are figures to switch between and to export —
        // the same condition the figures block itself is rendered under.
        actions={
          salesQuery.data && !isLoading && !error ? (
            <PeriodControls period={period} onPeriodChange={setPeriod} summary={salesQuery.data} />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        {isLoading ? (
          <DashboardLoading />
        ) : error ? (
          <DashboardError error={error} onRetry={retry} />
        ) : (
          <>
            {salesQuery.data && <TodaySection summary={salesQuery.data.today} />}
            {drawerQuery.data && <CashDrawerSection current={drawerQuery.data} />}
            {salesQuery.data && <PeriodSection summary={salesQuery.data} period={period} />}
            {summaryQuery.data && <NeedsAttentionSection summary={summaryQuery.data} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
