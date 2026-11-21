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
  // Pinned to the top of the POS product browser's sidebar. Set by hand in
  // the admin and stored here, not per device, so every till agrees on which
  // shelves come first.
  isFavorite: boolean;
  // Active, non-deleted products on this category AND everything under it —
  // the figure on the POS's category tiles. Rolled up through the tree so it
  // matches what selecting the category lists (includeSubcategories).
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}
