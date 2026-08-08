import type { I18n } from "@shared/types/common";

// One row of the product browser's sidebar: a category, plus how deep it sits
// in the tree so the row can be indented under its parent.
export interface SidebarCategory {
  id: string;
  name: I18n;
  depth: number;
  isFavorite: boolean;
}

// The sidebar's two groups. `favorites` is what the shop pinned in the admin
// (Category.isFavorite); `all` is the whole tree in reading order, pinned
// shelves included — a favourite is lifted to the top, not moved out of the
// list, so somebody who knows where a category lives still finds it there.
export interface SidebarCategories {
  favorites: SidebarCategory[];
  all: SidebarCategory[];
}
