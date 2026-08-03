import type { Category, CategoryNode } from "@shared/types/category";
import type { CreateCategoryInput, UpdateCategoryInput } from "@shared/schemas/category";
import { apiFetch } from "@/lib/api/client";

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const { data } = await apiFetch<CategoryNode[]>("/api/categories");
  return data;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const { data } = await apiFetch<Category>("/api/categories", { method: "POST", body: input });
  return data;
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  const { data } = await apiFetch<Category>(`/api/categories/${id}`, { method: "PATCH", body: input });
  return data;
}

export async function deleteCategory(id: string): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>(`/api/categories/${id}`, { method: "DELETE" });
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
