import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PRODUCT_LIST_PAGE_SIZE, PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { fetchProducts, fetchProduct } from "@/lib/api/products";
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
