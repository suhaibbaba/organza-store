import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CUSTOMER_SEARCH_QUERY_KEY } from "@/constants/api";
import { CUSTOMER_SEARCH_DEBOUNCE_MS } from "@/constants/pos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createCustomer, searchCustomers } from "@/lib/api/customers";

// By name or phone, across both Palestinian prefixes (the backend matches national digits).
export function useCustomerSearch(query: string, enabled: boolean) {
  const debounced = useDebouncedValue(query.trim(), CUSTOMER_SEARCH_DEBOUNCE_MS);
  const active = enabled && debounced.length > 0;
  const result = useQuery({
    queryKey: [...CUSTOMER_SEARCH_QUERY_KEY, debounced],
    queryFn: () => searchCustomers(debounced),
    enabled: active,
    placeholderData: keepPreviousData,
  });
  return {
    customers: active ? (result.data ?? []) : [],
    isLooking: active && (result.isFetching || debounced !== query.trim()),
    isActive: active,
  };
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CUSTOMER_SEARCH_QUERY_KEY }),
  });
}
