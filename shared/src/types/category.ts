import type { I18n } from "@/types/common";

// Minimal shape embedded in Product/ProductSummary responses.
export interface CategoryRef {
  id: string;
  name: I18n;
  slug: string;
}

export interface Category {
  id: string;
  name: I18n;
  slug: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}
