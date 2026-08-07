"use client";

import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { useDashboardSummaryQuery } from "@/hooks/use-dashboard";
import { useCurrentCashSessionQuery } from "@/hooks/use-cash-sessions";
import { useSalesSummaryQuery } from "@/hooks/use-reports";
import { TodaySection } from "@/components/dashboard/today-section";
import { CashDrawerSection } from "@/components/dashboard/cash-drawer-section";
import { PeriodSection } from "@/components/dashboard/period-section";
import { NeedsAttentionSection } from "@/components/dashboard/needs-attention-section";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-states";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{user ? t("welcome", { name: user.name }) : t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

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
  );
}
