import { useQuery } from "@tanstack/react-query";
import { PRODUCT_DETAIL_QUERY_KEY } from "@/constants/api";
import { fetchProduct } from "@/lib/api/products";

// Loads a tapped search result's variants. The list DTO has no per-variant
// breakdown, and the picker needs each variant's own price and stock, so a
// variant-bearing product costs one extra read — only when it is chosen.
export function useProductDetail(id: string | null) {
  return useQuery({
    queryKey: [...PRODUCT_DETAIL_QUERY_KEY, id],
    queryFn: () => fetchProduct(id!),
    enabled: Boolean(id),
    // Stock moves with every sale, so a picker opened after a checkout must
    // not show the count from before it.
    staleTime: 0,
  });
}
