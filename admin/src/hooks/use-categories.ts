import { useQuery } from "@tanstack/react-query";
import { CATEGORIES_QUERY_KEY } from "@/constants/api";
import { fetchCategoryTree } from "@/lib/api/categories";

export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategoryTree,
    staleTime: 5 * 60 * 1000,
  });
}
