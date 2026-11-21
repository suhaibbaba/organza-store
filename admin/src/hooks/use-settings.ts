import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY } from "@/constants/api";
import type { Setting } from "@organza/shared/types/setting";
import { fetchSettings, removeBrandImage, updateSettings, uploadBrandImage } from "@/lib/api/settings";
import { BRAND_IMAGE_KINDS } from "@/constants/settings";
import type { SaveSettingsInput } from "@/types/settings";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";

export function useSettingsQuery() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });
}

// The settings page's one Save: the fields first, then each branding image that changed.
export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  const { settingsChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: async ({ payload, images, onImageSaved }: SaveSettingsInput): Promise<Setting | null> => {
      let latest: Setting | null = null;
      const keep = (setting: Setting) => {
        latest = setting;
        queryClient.setQueryData(SETTINGS_QUERY_KEY, setting);
      };
      if (payload) {
        keep(await updateSettings(payload));
        settingsChanged();
      }
      for (const kind of BRAND_IMAGE_KINDS) {
        const change = images[kind];
        if (!change) continue;
        keep(change.kind === "replace" ? await uploadBrandImage(kind, change.file) : await removeBrandImage(kind));
        onImageSaved(kind);
      }
      return latest;
    },
  });
}
