import type { Category } from "@store/shared/types/category";
import { apiFetch } from "@/lib/api/client";

// Flat: the sidebar indents by parentId, and favourites can be lifted out of the tree.
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiFetch<Category[]>("/api/categories?flat=true");
  return data;
}
