import type { InventoryItem, StockAdjustResult } from "@store/shared/types/inventory";
import type { Pagination } from "@store/shared/types/common";
import { apiFetch } from "@/lib/api/client";
import type { InventoryListFilters } from "@/types/inventory";

function buildInventoryListQuery(filters: InventoryListFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.lowStock) params.set("lowStock", "true");
  return params.toString();
}

export async function fetchInventory(
  filters: InventoryListFilters
): Promise<{ items: InventoryItem[]; meta: Pagination | null }> {
  const query = buildInventoryListQuery(filters);
  const { data, meta } = await apiFetch<InventoryItem[]>(`/api/inventory?${query}`);
  return { items: data, meta };
}

export async function adjustProductStock(id: string, stock: number): Promise<StockAdjustResult> {
  const { data } = await apiFetch<StockAdjustResult>(`/api/inventory/products/${id}`, {
    method: "PATCH",
    body: { stock },
  });
  return data;
}

export async function adjustVariantStock(id: string, stock: number): Promise<StockAdjustResult> {
  const { data } = await apiFetch<StockAdjustResult>(`/api/inventory/variants/${id}`, {
    method: "PATCH",
    body: { stock },
  });
  return data;
}
