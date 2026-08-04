import { useQuery } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY } from "@/constants/api";
import { fetchSettings } from "@/lib/api/settings";

// Settings barely change and every price on the screen needs the currency,
// so this is fetched once and held for the shift.
export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 30 * 60 * 1000,
  });
}
