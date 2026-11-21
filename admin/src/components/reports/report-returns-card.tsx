"use client";

import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";
import { Typography } from "@store/ui";
import { DetailCard } from "@/components/layout/detail-card";
import { ReportFactRow } from "@/components/reports/report-fact-row";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReportReturnsCardProps } from "@/types/report";

// Apart from the sales figures, which are already net of returns: the hint says so to stop a double subtraction.
export function ReportReturnsCard({ returns }: ReportReturnsCardProps) {
  const t = useTranslations("reports.returns");
  const formatMoney = useMoneyFormatter();

  return (
    <DetailCard icon={Undo2} title={t("title")} data-testid="report-returns">
      {returns.itemCount === 0 ? (
        <Typography variant="body" tone="muted" as="p">
          {t("empty")}
        </Typography>
      ) : (
        <>
          <Typography variant="small" tone="muted" as="p">
            {t("amountHelp")}
          </Typography>
          <dl className="flex flex-col divide-y divide-line">
            <ReportFactRow name="returns-amount" label={t("amount")} value={formatMoney(returns.amount)} />
            <ReportFactRow
              name="returns-items"
              label={t("items")}
              hint={t("ordersCount", { count: returns.orderCount })}
              value={returns.itemCount}
            />
          </dl>
        </>
      )}
    </DetailCard>
  );
}
