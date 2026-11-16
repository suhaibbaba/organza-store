import { useCallback } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";
import { useSettingsQuery } from "@/hooks/use-settings";

// One formatter for every price on the selling screen, reading the currency
// from Settings (CLAUDE.md rule 14 — never hard-code a symbol). While
// settings are still loading there is nothing honest to show, so callers get
// back an empty string rather than a figure in the wrong currency.
export function useMoneyFormatter(): (amount: string | number) => string {
  const locale = useLocale();
  const { data: settings } = useSettingsQuery();
  const currency = settings?.currency;

  return useCallback(
    (amount: string | number) => (currency ? formatMoney(amount, currency, locale) : ""),
    [currency, locale]
  );
}
