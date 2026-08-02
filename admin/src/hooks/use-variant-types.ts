import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VARIANT_TYPES_QUERY_KEY } from "@/constants/api";
import { addOptionValue, createVariantType, fetchVariantTypes } from "@/lib/api/variantTypes";

export function useVariantTypesQuery() {
  return useQuery({
    queryKey: VARIANT_TYPES_QUERY_KEY,
    queryFn: fetchVariantTypes,
    staleTime: 60 * 1000,
  });
}

export function useCreateVariantTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createVariantType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VARIANT_TYPES_QUERY_KEY });
    },
  });
}

export function useAddOptionValueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantTypeId, value }: { variantTypeId: string; value: { ar: string } }) =>
      addOptionValue(variantTypeId, { value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VARIANT_TYPES_QUERY_KEY });
    },
  });
}
