import type { Setting } from "@store/shared/types/setting";
import type { UpdateSettingInput } from "@store/shared/schemas/setting";
import { apiFetch } from "@/lib/api/client";
import { BRAND_IMAGE_API_PATHS } from "@/constants/settings";
import type { BrandImageKind } from "@/types/settings";

export async function fetchSettings(): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings");
  return data;
}

export async function updateSettings(input: UpdateSettingInput): Promise<Setting> {
  const { data } = await apiFetch<Setting>("/api/settings", { method: "PATCH", body: input });
  return data;
}

export async function uploadBrandImage(kind: BrandImageKind, file: File): Promise<Setting> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiFetch<Setting>(BRAND_IMAGE_API_PATHS[kind], { method: "POST", body: formData });
  return data;
}

export async function removeBrandImage(kind: BrandImageKind): Promise<Setting> {
  const { data } = await apiFetch<Setting>(BRAND_IMAGE_API_PATHS[kind], { method: "DELETE" });
  return data;
}
