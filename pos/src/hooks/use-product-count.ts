import { useQuery } from "@tanstack/react-query";
import { CATEGORIES_STALE_TIME_MS, PRODUCT_COUNT_QUERY_KEY } from "@/constants/api";
import { countActiveProducts } from "@/lib/api/products";

// The figure on the "All" category tile. Held as long as the category list's
// own counts are, so the two move together.
export function useProductCount() {
  return useQuery({
    queryKey: PRODUCT_COUNT_QUERY_KEY,
    queryFn: countActiveProducts,
    staleTime: CATEGORIES_STALE_TIME_MS,
  });
}
