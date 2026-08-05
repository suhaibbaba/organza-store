"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import type { DiscountType } from "@shared/types/order";
import { formatPercent } from "@/lib/format";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";

// What was actually applied — "2%", or "20.00 ₪" — as opposed to what it
// took off.
//
// The two are not the same fact, and the cashier needs both: the money is
// what the customer saves, but the percentage is what was agreed with them,
// and it is the thing they will ask about. Showing only the money meant
// reopening the discount sheet to find out whether 2% or 5% had been keyed
// in, mid-sale, with the customer waiting.
//
// Returns null when nothing is applied, so callers can fall back to their
// "add a discount" wording.
export function useDiscountLabel(): (type: DiscountType | null, value: string | null) => string | null {
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();

  return useCallback(
    (type: DiscountType | null, value: string | null) => {
      if (!type || !value) return null;
      return type === "PERCENT" ? formatPercent(value, locale) : formatMoney(value);
    },
    [formatMoney, locale]
  );
}
