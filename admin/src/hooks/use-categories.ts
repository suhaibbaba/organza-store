import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CATEGORIES_QUERY_KEY } from "@/constants/api";
import { createCategory, deleteCategory, fetchCategoryTree, updateCategory } from "@/lib/api/categories";

export function useCategoriesQuery() {
  return useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategoryTree,
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
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
