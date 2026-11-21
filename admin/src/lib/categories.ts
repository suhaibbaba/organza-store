import type { CategoryNode } from "@store/shared/types/category";
import { foldSearchText } from "@store/ui/lib/support/search-text";
import type { CategoryTreeRow } from "@/types/category";

export function countCategories(nodes: CategoryNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countCategories(node.children), 0);
}

// Matches every stored language (rule 10); a match keeps its parents so it is still seen in place.
export function filterCategoryTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const term = foldSearchText(query);
  if (!term) {
    return nodes;
  }
  return nodes.flatMap((node) => {
    const children = filterCategoryTree(node.children, query);
    const matches = Object.values(node.name).some((name) => name && foldSearchText(name).includes(term));
    return matches || children.length > 0 ? [{ ...node, children: matches ? node.children : children }] : [];
  });
}

export function visibleCategoryRows(
  nodes: CategoryNode[],
  collapsedIds: ReadonlySet<string>,
  depth = 0,
): CategoryTreeRow[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(collapsedIds.has(node.id) ? [] : visibleCategoryRows(node.children, collapsedIds, depth + 1)),
  ]);
}

export function categoryIdsWithChildren(nodes: CategoryNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length > 0 ? [node.id, ...categoryIdsWithChildren(node.children)] : [],
  );
}

// A category's own subtree is never offered as its parent: the backend refuses the cycle.
export function categorySubtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(categorySubtreeIds)];
}
