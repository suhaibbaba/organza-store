import { prisma } from "@/lib/prisma";

/** A category and every descendant: products hang off one (usually leaf) node, so "Women" must include everything under it. */
export async function collectCategorySubtreeIds(rootId: string): Promise<string[]> {
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }
    const siblings = childrenByParent.get(category.parentId);
    if (siblings) {
      siblings.push(category.id);
    } else {
      childrenByParent.set(category.parentId, [category.id]);
    }
  }

  const ids: string[] = [rootId];
  // Breadth-first, with `ids` as the queue; `seen` guards against cycles in data predating CATEGORY_CIRCULAR_PARENT.
  const seen = new Set<string>([rootId]);
  for (let index = 0; index < ids.length; index += 1) {
    for (const childId of childrenByParent.get(ids[index]) ?? []) {
      if (seen.has(childId)) {
        continue;
      }
      seen.add(childId);
      ids.push(childId);
    }
  }

  return ids;
}

/** Products per category including descendants — the POS tile count must match what tapping the tile shows. */
export function rollUpCategoryCounts(
  categories: ReadonlyArray<{ id: string; parentId: string | null }>,
  directCounts: ReadonlyMap<string, number>,
): Map<string, number> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }
    const siblings = childrenByParent.get(category.parentId);
    if (siblings) {
      siblings.push(category.id);
    } else {
      childrenByParent.set(category.parentId, [category.id]);
    }
  }

  const totals = new Map<string, number>();
  for (const category of categories) {
    let total = 0;
    const queue = [category.id];
    const seen = new Set<string>(queue);
    for (let index = 0; index < queue.length; index += 1) {
      total += directCounts.get(queue[index]) ?? 0;
      for (const childId of childrenByParent.get(queue[index]) ?? []) {
        if (seen.has(childId)) {
          continue;
        }
        seen.add(childId);
        queue.push(childId);
      }
    }
    totals.set(category.id, total);
  }
  return totals;
}
