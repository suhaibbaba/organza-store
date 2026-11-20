import { prisma } from "@/lib/prisma";

/**
 * A category and every category filed underneath it, however deep.
 *
 * Categories nest (spec.md: Women > Dresses > Evening) but products hang off
 * exactly one node, and that node is usually a leaf. So "show me Women" has
 * to mean "show me everything under Women" — filtering on the id alone
 * answers with an empty shelf for the very categories a person is most likely
 * to tap.
 *
 * The whole table is loaded and walked in memory for the same reason
 * buildTree does it (routes/categories.ts): a boutique's category list is
 * tens of rows, and a recursive CTE here would buy nothing but a query that
 * is harder to read. The returned array always contains the root itself, so
 * a caller can hand it straight to `categoryId: { in: ... }`.
 */
export async function collectCategorySubtreeIds(rootId: string): Promise<string[]> {
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId);
    if (siblings) siblings.push(category.id);
    else childrenByParent.set(category.parentId, [category.id]);
  }

  const ids: string[] = [rootId];
  // Breadth-first over `ids` itself, which doubles as the queue. A `seen`
  // set is not paranoia: the API refuses to create a cycle
  // (CATEGORY_CIRCULAR_PARENT), but data that predates that check — or
  // arrives some other way — must not spin this loop forever.
  const seen = new Set<string>([rootId]);
  for (let index = 0; index < ids.length; index += 1) {
    for (const childId of childrenByParent.get(ids[index]) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      ids.push(childId);
    }
  }

  return ids;
}

/**
 * How many products sit on each category, counting everything filed beneath
 * it — the figure under each tile on the POS's category row.
 *
 * Rolled up through the tree for the same reason the list filter is
 * (`includeSubcategories`): tapping "Women" shows every dress under it, so the
 * number on the tile has to promise exactly that many, not the handful filed
 * on the parent itself. `directCounts` is what the database counted per
 * `categoryId`; a category absent from it simply has none of its own.
 *
 * Pure, so the roll-up is tested without a database. Guarded against a parent
 * cycle like collectCategorySubtreeIds above.
 */
export function rollUpCategoryCounts(
  categories: ReadonlyArray<{ id: string; parentId: string | null }>,
  directCounts: ReadonlyMap<string, number>
): Map<string, number> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const siblings = childrenByParent.get(category.parentId);
    if (siblings) siblings.push(category.id);
    else childrenByParent.set(category.parentId, [category.id]);
  }

  const totals = new Map<string, number>();
  for (const category of categories) {
    let total = 0;
    const queue = [category.id];
    const seen = new Set<string>(queue);
    for (let index = 0; index < queue.length; index += 1) {
      total += directCounts.get(queue[index]) ?? 0;
      for (const childId of childrenByParent.get(queue[index]) ?? []) {
        if (seen.has(childId)) continue;
        seen.add(childId);
        queue.push(childId);
      }
    }
    totals.set(category.id, total);
  }
  return totals;
}
