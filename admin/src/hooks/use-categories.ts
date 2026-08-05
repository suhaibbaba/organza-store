import { useMutation, useQuery } from "@tanstack/react-query";
import { CATEGORIES_QUERY_KEY } from "@/constants/api";
import { createCategory, deleteCategory, fetchCategoryTree, updateCategory } from "@/lib/api/categories";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";

export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategoryTree,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateCategories() {
  const { categoriesChanged } = useCacheInvalidation();
  return categoriesChanged;
}

export function useCreateCategoryMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: invalidate,
  });
}

export function useUpdateCategoryMutation(id: string) {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateCategory>[1]) => updateCategory(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCategoryMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
  });
}
