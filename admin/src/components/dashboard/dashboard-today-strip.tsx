"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, ReceiptText, ShoppingBag, Truck } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { DASHBOARD_RISE_STEP_MS } from "@/constants/dashboard";
import type { DashboardTodayStripProps } from "@/types/dashboard";
import { owedTotal } from "@/lib/report-figures";

const CARD_MOTION = "animate-rise transition duration-300 hover:-translate-y-0.5 hover:shadow-card-hover";

// Sold = received + still owed, always all three; the order count beside them.
export function DashboardTodayStrip({ today }: DashboardTodayStripProps) {
  const t = useTranslations("dashboard.today");
  const tFigures = useTranslations("figures");
  const formatMoney = useMoneyFormatter();
  const { totals } = today;

  const delay = (index: number) => ({ animationDelay: `${(index + 1) * DASHBOARD_RISE_STEP_MS}ms` });

  return (
    <section aria-label={t("title")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        name="sold"
        icon={ShoppingBag}
        label={tFigures("sold.label")}
        tooltip={tFigures("sold.help")}
        value={formatMoney(totals.revenue)}
        hint={t("pieces", { count: totals.itemCount })}
        className={CARD_MOTION}
        style={delay(0)}
      />
      <StatCard
        name="received"
        tone="success"
        icon={CircleCheck}
        label={tFigures("received.label")}
        tooltip={tFigures("received.help")}
        value={formatMoney(totals.collectedRevenue)}
        hint={t("receivedHint")}
        className={CARD_MOTION}
        style={delay(1)}
      />
      <StatCard
        name="owed"
        tone="warning"
        icon={Truck}
        label={tFigures("owed.label")}
        tooltip={tFigures("owed.help")}
        value={formatMoney(owedTotal(totals))}
        hint={
          Number(totals.customerDebtAmount) > 0
            ? t("owedSplit", {
                courier: formatMoney(totals.pendingCollectionAmount),
                customers: formatMoney(totals.customerDebtAmount),
              })
            : t("owedOrders", { count: totals.pendingCollectionOrderCount })
        }
        className={CARD_MOTION}
        style={delay(2)}
      />
      <StatCard
        name="orders"
        icon={ReceiptText}
        label={t("ordersLabel")}
        value={totals.orderCount}
        hint={t("averageHint", { amount: formatMoney(totals.averageOrderValue) })}
        className={CARD_MOTION}
        style={delay(3)}
      />
    </section>
  );
}
