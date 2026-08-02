import type { I18n } from "@/types/common";

// The Setting singleton row (CLAUDE.md rule 14).
export interface Setting {
  id: string;
  storeName: I18n;
  defaultLanguage: string;
  supportedLanguages: string[];
  currency: string;
  defaultCountryCode: string;
  lowStockThreshold: number;
  updatedAt: string;
}
