"use client";

import { useTranslations } from "next-intl";
import { Alert } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { SalesReturnsNoteProps } from "@/types/sales";

// The figures above are already net of returns; this says how much came back so the gap is explained.
export function SalesReturnsNote({ returns }: SalesReturnsNoteProps) {
  const t = useTranslations("sales");
  const formatMoney = useMoneyFormatter();
  if (returns.itemCount === 0) {
    return null;
  }
  return (
    <Alert tone="info" data-testid="sales-returns">
      {t("returns", { count: returns.itemCount, amount: formatMoney(returns.amount) })}
    </Alert>
  );
}
