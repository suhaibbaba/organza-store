import type { ApiEnvelope } from "@store/shared/types";
import type { Branding } from "@store/shared/types/setting";
import { BRANDING_API_PATH } from "@/constants/pwa";
import { API_BASE_URL } from "@/lib/env";

// Server side only: what the shop uploaded, or null when the API cannot be reached (the built-in icons then stand in).
export async function fetchBranding(): Promise<Branding | null> {
  try {
    const response = await fetch(new URL(BRANDING_API_PATH, API_BASE_URL), { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as ApiEnvelope<Branding>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}
