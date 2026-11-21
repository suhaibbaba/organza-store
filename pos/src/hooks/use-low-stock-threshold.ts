import { DEFAULT_LOW_STOCK_THRESHOLD } from "@store/shared/constants/inventory";
import { useSettingsQuery } from "@/hooks/use-settings";

// From Settings (rule 14); the fallback only covers the moment before the settings query answers.
export function useLowStockThreshold(): number {
  const { data: settings } = useSettingsQuery();
  return settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}
