"use client";

import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session-provider";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useDashboardSummaryQuery } from "@/hooks/use-dashboard";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { DashboardError, DashboardLoading } from "@/components/dashboard/dashboard-states";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { user } = useSession();
  const { data: settings } = useSettingsQuery();
  const { data: summary, isLoading, isError, error, refetch } = useDashboardSummaryQuery();

  const currency = settings?.currency ?? "ILS";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{user ? t("welcome", { name: user.name }) : t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <DashboardLoading />
      ) : isError ? (
        <DashboardError error={error} onRetry={() => void refetch()} />
      ) : summary ? (
        <DashboardSummary summary={summary} currency={currency} />
      ) : null}
    </div>
  );
}
