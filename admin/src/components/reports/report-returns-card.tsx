"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportFigure } from "@/components/reports/report-figure";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ReturnsTotals } from "@/types/report";

// What came back. Kept beside the sales figures rather than folded into
// them: the totals above are already net of returns, so this answers the
// separate question of how much was handed back.
export function ReportReturnsCard({ returns }: { returns: ReturnsTotals }) {
  const t = useTranslations("reports.returns");
  const formatMoney = useMoneyFormatter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {returns.itemCount === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <ReportFigure label={t("amount")} value={formatMoney(returns.amount)} />
            <ReportFigure
              label={t("items")}
              value={returns.itemCount}
              hint={t("orders", { count: returns.orderCount })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
