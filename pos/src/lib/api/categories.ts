import type { Category } from "@organza/shared/types/category";
import { apiFetch } from "@/lib/api/client";

// The shop's shelves, for the product browser's sidebar.
//
// Flat rather than nested: the sidebar is one scrolling column and draws its
// own indentation from `parentId`, and a flat list is also what lets
// favourites be lifted out of the middle of the tree into their own group at
// the top without having to re-nest anything.
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiFetch<Category[]>("/api/categories?flat=true");
  return data;
}
