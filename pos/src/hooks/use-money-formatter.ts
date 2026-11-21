import { useCallback } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";
import { useSettingsQuery } from "@/hooks/use-settings";

// Currency from Settings (rule 14); empty while loading rather than a figure in the wrong currency.
export function useMoneyFormatter(): (amount: string | number) => string {
  const locale = useLocale();
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency;

  return useCallback(
    (amount: string | number) => (currency ? formatMoney(amount, currency, locale) : ""),
    [currency, locale],
  );
}
