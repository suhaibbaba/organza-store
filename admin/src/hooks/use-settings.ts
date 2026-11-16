import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY } from "@/constants/api";
import { fetchSettings, updateSettings } from "@/lib/api/settings";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  const { settingsChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
      // The currency and the low-stock threshold are read by other screens
      // too (the dashboard tile, the stock list's filter), and those hold
      // numbers computed from the old ones until they are re-read.
      settingsChanged();
    },
  });
}
