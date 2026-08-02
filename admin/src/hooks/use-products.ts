import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_LIST_PAGE_SIZE, PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  generateVariants,
  updateVariant,
  deleteVariant,
} from "@/lib/api/products";
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

export function useProductQuery(id: string) {
  return useQuery({
    queryKey: [PRODUCT_LIST_QUERY_KEY, id],
    queryFn: () => fetchProduct(id),
  });
}

// Invalidates both the list and this product's detail cache after any
// create/update/variant mutation, so navigating back always shows fresh data.
function useInvalidateProducts(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY] });
    if (id) void queryClient.invalidateQueries({ queryKey: [PRODUCT_LIST_QUERY_KEY, id] });
  };
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
