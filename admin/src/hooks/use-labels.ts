import { useCallback } from "react";
import { useMutation, useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type { Product } from "@shared/types/product";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { fetchProduct, markLabelsPrinted } from "@/lib/api/products";

// Declared at module level so its identity never changes: react-query only
// memoizes a `combine` result while the function itself is stable, and the
// label run is rebuilt from these products on every keystroke — an array that
// changed identity each render would rebuild the whole sheet for nothing.
function combineProducts(results: UseQueryResult<Product>[]) {
  return {
    products: results.flatMap((result) => (result.data ? [result.data] : [])),
    isLoading: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error ?? null,
  };
}

// Full detail for every selected product: the list endpoint returns aggregate
// stock only, and a label per variant needs each variant's own barcode and
// stock. Same query key as useProductQuery, so a product already opened
// elsewhere is served from cache.
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

// Records the print run. Invalidates the product list so the products just
// printed leave the "not printed yet" filter straight away.
export function useMarkLabelsPrintedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markLabelsPrinted,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
    },
  });
}
