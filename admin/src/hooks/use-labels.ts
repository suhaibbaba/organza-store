import { useCallback } from "react";
import { useMutation, useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Product } from "@store/shared/types/product";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { fetchProduct, markLabelsPrinted } from "@/lib/api/products";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";

// Module-level so react-query keeps memoizing the combined result.
function combineProducts(results: UseQueryResult<Product>[]) {
  return {
    products: results.flatMap((result) => (result.data ? [result.data] : [])),
    isLoading: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error ?? null,
  };
}

// Full detail per product: labels need each variant's barcode and stock; shares useProductQuery's key.
export function useSelectedProductsQueries(productIds: readonly string[]) {
  return useQueries({
    queries: productIds.map((id) => ({
      queryKey: [PRODUCT_LIST_QUERY_KEY, id],
      queryFn: () => fetchProduct(id),
    })),
    combine: combineProducts,
  });
}

export function useRefetchSelectedProducts(productIds: readonly string[]) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    for (const id of productIds) {
      void queryClient.refetchQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY, id] });
    }
  }, [queryClient, productIds]);
}

// So printed products leave the "not printed yet" filter at once.
export function useMarkLabelsPrintedMutation() {
  const { productChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: markLabelsPrinted,
    onSuccess: () => productChanged(),
  });
}
