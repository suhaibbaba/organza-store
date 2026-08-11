import { DEFAULT_LOW_STOCK_THRESHOLD } from "@organza/shared/constants/inventory";
import { useSettingsQuery } from "@/hooks/use-settings";

// What counts as "nearly out", from the Setting singleton (CLAUDE.md rule 14
// — never a number written into a screen). The fallback is only for the first
// moment of the shift, before the settings query has answered; unlike a
// currency symbol, a threshold that is briefly the default cannot show the
// cashier anything untrue — the worst it does is call a quantity "in stock"
// for a second longer than the shop would.
export function useLowStockThreshold(): number {
  const { data: settings } = useSettingsQuery();
  return settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}
