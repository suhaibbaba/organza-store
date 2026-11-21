import { useQuery } from "@tanstack/react-query";
import { CATEGORIES_QUERY_KEY, CATEGORIES_STALE_TIME_MS } from "@/constants/api";
import { fetchCategories } from "@/lib/api/categories";

// The category list behind the selling screen's category tiles, with each
// shelf's product count. Fetched once and held: a boutique adds a shelf a few
// times a year.
export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    staleTime: CATEGORIES_STALE_TIME_MS,
  });
}
