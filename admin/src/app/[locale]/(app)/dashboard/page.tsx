"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { useDashboardSummaryQuery } from "@/hooks/use-dashboard";
import { useCurrentCashSessionQuery } from "@/hooks/use-cash-sessions";
import { useSalesSummaryQuery } from "@/hooks/use-reports";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TodaySection } from "@/components/dashboard/today-section";
import { CashDrawerSection } from "@/components/dashboard/cash-drawer-section";
import { PeriodSection } from "@/components/dashboard/period-section";
import { NeedsAttentionSection } from "@/components/dashboard/needs-attention-section";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-states";

// Figures only, in the order of the day (today, drawer, period, to-do). Admin/Manager; an Employee sent here is forwarded to their own first screen.
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
  // The same name the account button shows, never a raw id.
  const { name: displayName } = useUserDisplay()(user);

  const summaryQuery = useDashboardSummaryQuery();
  const salesQuery = useSalesSummaryQuery();
  const drawerQuery = useCurrentCashSessionQuery();

  // Judged together: half a dashboard with a section silently missing is worse than an error.
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
        name="dashboard"
        title={user ? t("welcome", { name: displayName }) : t("title")}
        description={t("subtitle")}
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
            {salesQuery.data && <PeriodSection summary={salesQuery.data} />}
            {summaryQuery.data && <NeedsAttentionSection summary={summaryQuery.data} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
