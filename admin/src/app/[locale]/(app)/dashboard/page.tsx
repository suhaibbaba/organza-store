"use client";

import { can } from "@store/shared/lib/permissions";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { useDashboardSummaryQuery } from "@/hooks/use-dashboard";
import { useCurrentCashSessionQuery } from "@/hooks/use-cash-sessions";
import { useDailySalesQuery, useSalesSummaryQuery } from "@/hooks/use-reports";
import { PageContainer } from "@/components/layout/page-container";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardTodayStrip } from "@/components/dashboard/dashboard-today-strip";
import { DashboardSalesBars } from "@/components/dashboard/dashboard-sales-bars";
import { DashboardRecentOrders } from "@/components/dashboard/dashboard-recent-orders";
import { DashboardPeriodBrief } from "@/components/dashboard/dashboard-period-brief";
import { CashDrawerSection } from "@/components/dashboard/cash-drawer-section";
import { DashboardTodoList } from "@/components/dashboard/dashboard-todo-list";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-states";

// Banner and today's strip, then the week in bars, latest orders and the period brief beside the drawer and the to-do list. Admin/Manager only.
export default function DashboardPage() {
  return (
    <RoleGuard action="dashboard.view" onDenied="redirect">
      <DashboardPageContent />
    </RoleGuard>
  );
}

function DashboardPageContent() {
  const { user } = useSession();
  const { name: displayName } = useUserDisplay()(user);

  const summaryQuery = useDashboardSummaryQuery();
  const salesQuery = useSalesSummaryQuery();
  const dailyQuery = useDailySalesQuery();
  const drawerQuery = useCurrentCashSessionQuery();

  // Judged together: half a dashboard with a section silently missing is worse than an error.
  const queries = [summaryQuery, salesQuery, dailyQuery, drawerQuery];
  const isLoading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.error)?.error;

  function retry() {
    for (const query of queries) {
      void query.refetch();
    }
  }

  function renderBody() {
    if (isLoading) {
      return <DashboardLoading />;
    }
    if (error || !salesQuery.data || !summaryQuery.data || !dailyQuery.data) {
      return <DashboardError error={error} onRetry={retry} />;
    }
    const drawer = drawerQuery.data;

    return (
      <>
        <DashboardHero name={displayName} today={salesQuery.data.today} drawer={drawer} />
        <DashboardTodayStrip today={salesQuery.data.today} />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <DashboardSalesBars daily={dailyQuery.data} />
            {can(user, "order.view") && <DashboardRecentOrders />}
            <DashboardPeriodBrief summary={salesQuery.data} />
          </div>

          {/* On a phone the drawer and the to-do list come before the chart: they are the day's first jobs. */}
          <div className="order-first flex flex-col gap-5 lg:order-none">
            {drawer && <CashDrawerSection current={drawer} />}
            <DashboardTodoList summary={summaryQuery.data} drawer={drawer} />
          </div>
        </div>
      </>
    );
  }

  return (
    <PageContainer>
      <div data-test-selector="dashboard" className="flex flex-col gap-5">
        {renderBody()}
      </div>
    </PageContainer>
  );
}
