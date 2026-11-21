"use client";

import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { DetailCard } from "@/components/layout/detail-card";
import { ReportFactRow } from "@/components/reports/report-fact-row";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportOrdersCardProps } from "@/types/report";

export function ReportOrdersCard({ totals }: ReportOrdersCardProps) {
  const t = useTranslations("reports.orders");
  const formatMoney = useMoneyFormatter();

  return (
    <DetailCard icon={ReceiptText} title={t("title")} data-testid="report-orders">
      <dl className="flex flex-col divide-y divide-line">
        <ReportFactRow name="orders" label={t("count")} value={totals.orderCount} />
        <ReportFactRow name="items" label={t("items")} value={totals.itemCount} />
        <ReportFactRow name="average" label={t("average")} value={formatMoney(totals.averageOrderValue)} />
        <ReportFactRow name="discounts" label={t("discounts")} value={formatMoney(totals.discountAmount)} />
      </dl>
    </DetailCard>
  );
}
