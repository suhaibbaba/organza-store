"use client";

import { useLocale } from "next-intl";
import { currencySymbol } from "@/lib/format";
import { useSettingsQuery } from "@/hooks/use-settings";

// The shop's currency symbol on its own, for the places that have to NAME the
// currency rather than format an amount in it — the discount dialog's "fixed
// amount" option, and the label over its value field. Empty while settings
// are still loading, for the same reason useMoneyFormatter returns an empty
// string: a symbol from the wrong currency is worse than no symbol.
export function useCurrencySymbol(): string {
  const locale = useLocale();
  const { data: settings } = useSettingsQuery();
  return settings?.currency ? currencySymbol(settings.currency, locale) : "";
}
