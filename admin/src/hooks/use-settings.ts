import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY } from "@/constants/api";
import { fetchSettings, updateSettings } from "@/lib/api/settings";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => queryClient.setQueryData(SETTINGS_QUERY_KEY, data),
  });
}
