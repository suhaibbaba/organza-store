import type { I18n } from "@/types/common";
import type { LABEL_PRINT_MODES } from "@/constants/label";
import type { SaleNotificationMode } from "@/types/push";
import type { FAVICON_SIZES } from "@/constants/brand";

export type LabelPrintMode = (typeof LABEL_PRINT_MODES)[number];

// The Setting singleton row (CLAUDE.md rule 14).
export interface Setting {
  id: string;
  storeName: I18n;
  defaultLanguage: string;
  supportedLanguages: string[];
  currency: string;
  defaultCountryCode: string;
  lowStockThreshold: number;
  logoUrl: string | null; // API-relative ("/uploads/…"); null when no logo was uploaded
  faviconUrls: FaviconUrls | null; // API-relative, one per size; null = the built-in icons
  // Barcode labels, in millimetres: THERMAL is one label per page; the grid and page fields apply only to A4_GRID.
  labelPrintMode: LabelPrintMode;
  labelWidthMm: number;
  labelHeightMm: number;
  labelColumns: number;
  labelRows: number;
  labelPageMarginTopMm: number;
  labelPageMarginRightMm: number;
  labelPageMarginBottomMm: number;
  labelPageMarginLeftMm: number;
  labelGapXMm: number;
  labelGapYMm: number;
  // Sale notifications (Web Push to Admins): only EVERY_SALE is implemented; minAmount is kept in every mode.
  saleNotificationsEnabled: boolean;
  saleNotificationMode: SaleNotificationMode;
  saleNotificationMinAmount: string;
  updatedAt: string;
}

export type FaviconSize = (typeof FAVICON_SIZES)[number];
export type FaviconUrls = Record<FaviconSize, string>;

// GET /api/branding — open to anyone, so a tab or a home-screen icon can draw it before sign-in.
export interface Branding {
  storeName: I18n;
  logoUrl: string | null;
  faviconUrls: FaviconUrls | null;
}
