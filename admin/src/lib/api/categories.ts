import type { CategoryNode } from "@shared/types/category";
import { apiFetch } from "@/lib/api/client";

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const { data } = await apiFetch<CategoryNode[]>("/api/categories");
  return data;
}

export interface FlatCategoryOption {
  id: string;
  name: CategoryNode["name"];
  depth: number;
}

// Flattens the nested tree into depth-annotated rows so a plain <select>
// can show sub-categories indented under their parent.
export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): FlatCategoryOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}
