import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CUSTOMER_SUGGESTION_MIN_DIGITS } from "@store/shared/constants/order";
import { nationalPhoneDigits } from "@store/shared/lib/phone";
import { CUSTOMER_SUGGESTION_QUERY_KEY } from "@/constants/api";
import { CUSTOMER_SUGGESTION_DEBOUNCE_MS } from "@/constants/pos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchCustomerSuggestions } from "@/lib/api/orders";

// Matched on national digits: one Palestine line may be filed under +970 or +972 (rule 18).
export function useCustomerSuggestions(phone: string) {
  const digits = nationalPhoneDigits(phone.trim());
  const debounced = useDebouncedValue(digits, CUSTOMER_SUGGESTION_DEBOUNCE_MS);
  const enabled = debounced.length >= CUSTOMER_SUGGESTION_MIN_DIGITS;

  const result = useQuery({
    queryKey: [...CUSTOMER_SUGGESTION_QUERY_KEY, debounced],
    queryFn: () => fetchCustomerSuggestions(debounced),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    suggestions: enabled ? (result.data ?? []) : [],
    // Pending shows as looking, so nobody reads it as a new customer.
    isLooking: enabled && (result.isPending || digits !== debounced),
    isActive: enabled,
  };
}
