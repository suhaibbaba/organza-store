import { useQuery } from "@tanstack/react-query";
import { CATEGORIES_QUERY_KEY, CATEGORIES_STALE_TIME_MS } from "@/constants/api";
import { fetchCategories } from "@/lib/api/categories";

// The category list behind the product browser's sidebar. Fetched once and
// held: a boutique adds a shelf a few times a year, and re-asking every time
// the drawer opens would put a spinner in front of the cashier for something
// that has not changed since this morning.
// Only ever mounted inside the open drawer, so a till that never browses
// never asks for this at all.
export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    staleTime: CATEGORIES_STALE_TIME_MS,
  });
}
