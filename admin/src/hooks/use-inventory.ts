import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { InventoryItem } from "@store/shared/types/inventory";
import { INVENTORY_LIST_QUERY_KEY } from "@/constants/inventory";
import { adjustProductStock, adjustVariantStock, fetchInventory } from "@/lib/api/inventory";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import type { InventoryListFilters } from "@/types/inventory";

export function useInventoryQuery(filters: InventoryListFilters) {
  return useQuery({
    queryKey: [INVENTORY_LIST_QUERY_KEY, filters],
    queryFn: () => fetchInventory(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAdjustStockMutation() {
  const { productChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ item, stock }: { item: InventoryItem; stock: number }) =>
      item.type === "variant" ? adjustVariantStock(item.id, stock) : adjustProductStock(item.id, stock),
    onSuccess: (_result, { item }) => productChanged(item.productId),
  });
}
