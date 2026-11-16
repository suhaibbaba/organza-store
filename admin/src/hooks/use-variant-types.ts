import { useMutation, useQuery } from "@tanstack/react-query";
import { VARIANT_TYPES_QUERY_KEY } from "@/constants/api";
import { addOptionValue, createVariantType, fetchVariantTypes } from "@/lib/api/variantTypes";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";

export function useVariantTypesQuery() {
  return useQuery({
    queryKey: VARIANT_TYPES_QUERY_KEY,
    queryFn: fetchVariantTypes,
    staleTime: 60 * 1000,
  });
}

export function useCreateVariantTypeMutation() {
  const { variantTypesChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: createVariantType,
    onSuccess: variantTypesChanged,
  });
}

export function useAddOptionValueMutation() {
  const { variantTypesChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ variantTypeId, value }: { variantTypeId: string; value: { ar: string } }) =>
      addOptionValue(variantTypeId, { value }),
    onSuccess: variantTypesChanged,
  });
}
