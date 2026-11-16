import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  DEFAULT_PRODUCT_FILTERS,
  PRODUCT_LIST_PAGE_SIZE,
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
    queryFn: () => fetchProducts(filters, PRODUCT_LIST_PAGE_SIZE),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state.
    placeholderData: keepPreviousData,
  });
}

/**
 * How many quick-sold pieces are still waiting to be finished off (spec.md
 * "Quick sell").
 *
 * A count rather than a list: it rides on the products screen's own tab so
 * that a season's worth of "sell now, tidy up later" cannot quietly turn into
 * a pile nobody remembers. One row is fetched and thrown away — the figure
 * that matters is `meta.total`.
 *
 * Only ever asked for by somebody who may act on it; the tab is not drawn for
 * anybody else, so the query is not made either.
 */
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

// Every product write lands on the same set of screens — the list, this
// product's page, the stock list and the dashboard — so they all go through
// one map (hooks/use-cache-invalidation.ts) rather than each mutation
// remembering its own.
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

// Soft delete (CLAUDE.md rule 4) — the product drops out of every list, so
// both caches are refreshed the same way an edit refreshes them.
export function useDeleteProductMutation(id: string) {
  const invalidate = useInvalidateProducts(id);
  return useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: invalidate,
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
