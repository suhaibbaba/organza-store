"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import type { DiscountType } from "@store/shared/types/order";
import { formatPercent } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

// What was applied (2% or 20.00 ₪), not what it took off: the agreed figure is what customers ask about.
export function useDiscountLabel(): (type: DiscountType | null, value: string | null) => string | null {
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return useCallback(
    (type: DiscountType | null, value: string | null) => {
      if (!type || !value) {
        return null;
      }
      return type === "PERCENT" ? formatPercent(value, locale) : formatMoney(value);
    },
    [formatMoney, locale],
  );
}
