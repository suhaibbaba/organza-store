import type { IconName, SectionTone } from "@store/ui";
import type { BrandImageKind } from "@/types/settings";

export const SETTINGS_SECTIONS = {
  "store-info": { icon: "store", tone: "blue" },
  regional: { icon: "globe", tone: "violet" },
  inventory: { icon: "package", tone: "amber" },
  labels: { icon: "barcode", tone: "green" },
  branding: { icon: "image", tone: "rose" },
  "sale-notifications": { icon: "bell", tone: "amber" },
} as const satisfies Record<string, { icon: IconName; tone: SectionTone }>;

export type SettingsSectionName = keyof typeof SETTINGS_SECTIONS;

export const BRAND_IMAGE_KINDS = ["logo", "favicon"] as const satisfies readonly BrandImageKind[];

export const BRAND_IMAGE_API_PATHS: Record<BrandImageKind, string> = {
  logo: "/api/settings/logo",
  favicon: "/api/settings/favicon",
};

// The backend's accepted image types (DEFAULT_ALLOWED_IMAGE_TYPES).
export const BRAND_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

// Sizes the favicon preview is drawn at: the browser tab and the home-screen icon.
export const FAVICON_PREVIEW_TAB_SIZE = 32;
export const FAVICON_PREVIEW_APP_SIZE = 180;
