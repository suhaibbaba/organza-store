import { useLocale, useTranslations } from "next-intl";
import { Shirt, AlertTriangle, FolderTree, Wallet } from "lucide-react";
import type { DashboardSummary as DashboardSummaryData } from "@shared/types/dashboard";
import { formatMoney } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesPlaceholderCard } from "@/components/dashboard/sales-placeholder-card";

interface DashboardSummaryProps {
  summary: DashboardSummaryData;
  currency: string;
}

export function DashboardSummary({ summary, currency }: DashboardSummaryProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Shirt}
          label={t("cards.products.label")}
          value={summary.products.total}
          subtitle={t("cards.products.subtitle", {
            active: summary.products.active,
            hidden: summary.products.hidden,
          })}
          href="/products"
        />

        <StatCard
          icon={AlertTriangle}
          label={t("cards.lowStock.label")}
          value={summary.lowStock.count}
          subtitle={t("cards.lowStock.subtitle", { threshold: summary.lowStock.threshold })}
          href="/inventory?lowStock=true"
          tone={summary.lowStock.count > 0 ? "warning" : "default"}
        />

        <StatCard icon={FolderTree} label={t("cards.categories.label")} value={summary.categories.total} href="/categories" />

        <StatCard
          icon={Wallet}
          label={t("cards.inventoryValue.label")}
          value={formatMoney(summary.inventoryValue.amount, currency, locale)}
          subtitle={
            summary.inventoryValue.basis === "cost"
              ? t("cards.inventoryValue.basisCost")
              : t("cards.inventoryValue.basisPrice")
          }
        />
      </div>

      <SalesPlaceholderCard />
    </div>
  );
}
