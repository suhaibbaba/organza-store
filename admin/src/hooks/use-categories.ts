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

// Pinning a category to the top of the POS product browser's sidebar
// (spec.md "POS product browser"). Separate from useUpdateCategoryMutation,
// which is bound to one id at construction: the star is drawn on every row of
// a recursive tree, so the id has to travel with the click.
export function useToggleCategoryFavoriteMutation() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => updateCategory(id, { isFavorite }),
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
