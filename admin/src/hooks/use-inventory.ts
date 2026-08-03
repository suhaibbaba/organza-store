import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InventoryItem } from "@shared/types/inventory";
import { INVENTORY_LIST_PAGE_SIZE, INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import { adjustProductStock, adjustVariantStock, fetchInventory } from "@/lib/api/inventory";
import type { InventoryListFilters } from "@/types/inventory";

export function useInventoryQuery(filters: InventoryListFilters) {
  return useQuery({
    queryKey: [INVENTORY_LIST_QUERY_KEY, filters],
    queryFn: () => fetchInventory(filters, INVENTORY_LIST_PAGE_SIZE),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state.
    placeholderData: keepPreviousData,
  });
}

// One mutation per rendered stock control (CLAUDE.md rule 6 — every change
// is server-audited as STOCK_CHANGE; this just reflects success/error).
// Routes to whichever endpoint matches the row (simple product vs variant).
export function useAdjustStockMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, stock }: { item: InventoryItem; stock: number }) =>
      item.type === "variant" ? adjustVariantStock(item.id, stock) : adjustProductStock(item.id, stock),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [INVENTORY_LIST_QUERY_KEY] }),
  });
}
