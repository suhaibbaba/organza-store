import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PRODUCT_FILTERS,
  PRODUCT_LIST_QUERY_KEY,
} from "@/constants/products";
import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  generateVariants,
  updateVariant,
  deleteProduct,
  deleteVariant,
} from "@/lib/api/products";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import type { ProductListFilters } from "@/types/product";

export function useProductsQuery(filters: ProductListFilters) {
  return useQuery({
    queryKey: [PRODUCT_LIST_QUERY_KEY, filters],
    queryFn: () => fetchProducts(filters, filters.pageSize),
    // The current rows stay on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  });
}

// How many quick-sold pieces still need completing (rule 23); only fetched for whoever can act on it.
export function useNeedsCompletingCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: [PRODUCT_LIST_QUERY_KEY, "needsCompletingCount"],
    queryFn: async () => {
      const { meta } = await fetchProducts(
        { ...DEFAULT_PRODUCT_FILTERS, completeness: "needs_completing" },
        1
      );
      return meta?.total ?? 0;
    },
    enabled,
  });
}

export function useProductQuery(id: string) {
  return useQuery({
    queryKey: [PRODUCT_LIST_QUERY_KEY, id],
    queryFn: () => fetchProduct(id),
  });
}

// Every product write refreshes the same screens through one map (hooks/use-cache-invalidation.ts).
function useInvalidateProducts(id?: string) {
  const { productChanged } = useCacheInvalidation();
  return () => productChanged(id);
}

export function useCreateProductMutation() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: invalidate,
  });
}

export function useUpdateProductMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: (input: Parameters<typeof updateProduct>[1]) => updateProduct(id, input),
    onSuccess: invalidate,
  });
}

// Soft delete (rule 4): the product leaves every list, so caches refresh as for an edit.
export function useDeleteProductMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: invalidate,
  });
}

// The list's row menu: one mutation for every row, the id given at call time.
export function useDeleteAnyProductMutation() {
  const { productChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_data, id) => productChanged(id),
  });
}

export function useGenerateVariantsMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: (input: Parameters<typeof generateVariants>[1]) => generateVariants(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateVariantMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: Parameters<typeof updateVariant>[2] }) =>
      updateVariant(id, variantId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteVariantMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: (variantId: string) => deleteVariant(id, variantId),
    onSuccess: invalidate,
  });
}
