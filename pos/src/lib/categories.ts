import type { Category } from "@organza/shared/types/category";
import type { SidebarCategories, SidebarCategory } from "@/types/category";

// The flat category list the API returns, arranged the way the browser's
// sidebar reads it: the shop's pinned shelves first, then the whole tree in
// parent-then-children order with a depth on each row to indent by.
//
// Both groups come out of one pass so a category can appear in each without
// being duplicated in memory or drifting apart — the pinned copy at the top
// and the row down in the tree are the same category, and selecting either
// filters the grid the same way.
export function buildSidebarCategories(categories: Category[] | undefined): SidebarCategories {
  if (!categories || categories.length === 0) return { favorites: [], all: [] };

  const childrenByParent = new Map<string | null, Category[]>();
  const known = new Set(categories.map((category) => category.id));
  for (const category of categories) {
    // A child whose parent isn't in the list (it can't normally happen, but a
    // half-loaded page must not swallow rows) is treated as a root, so every
    // category is reachable from somewhere.
    const parentKey = category.parentId && known.has(category.parentId) ? category.parentId : null;
    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(category);
    else childrenByParent.set(parentKey, [category]);
  }

  const all: SidebarCategory[] = [];
  const favorites: SidebarCategory[] = [];
  const visited = new Set<string>();

  // Depth-first from the roots: a child is listed directly under its parent,
  // which is what makes the indentation mean anything. `visited` guards
  // against a parent cycle in data that predates the API's cycle check —
  // without it this recursion would never return.
  function walk(parentId: string | null, depth: number) {
    for (const category of childrenByParent.get(parentId) ?? []) {
      if (visited.has(category.id)) continue;
      visited.add(category.id);

      const row: SidebarCategory = {
        id: category.id,
        name: category.name,
        depth,
        isFavorite: category.isFavorite,
      };
      all.push(row);
      // Pinned rows are shown as a flat group of their own, so they carry no
      // indentation — "Abayas" at the top means the same shelf whether or not
      // the cashier knows it lives under "Women".
      if (category.isFavorite) favorites.push({ ...row, depth: 0 });

      walk(category.id, depth + 1);
    }
  }

  walk(null, 0);
  return { favorites, all };
}
