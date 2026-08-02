import { useQuery } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY } from "@/constants/api";
import { fetchSettings } from "@/lib/api/settings";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });
}
