import type { I18n } from "@/types/common";
import type { LABEL_PRINT_MODES } from "@/constants/label";

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
  // --- barcode-label printing ---
  // Every dimension is in millimetres. THERMAL prints one label per page (the
  // page is the label); A4_GRID lays labels out on a sheet, so the grid and
  // page fields below only matter in that mode.
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
  updatedAt: string;
}
