import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CUSTOMER_SUGGESTION_MIN_DIGITS } from "@shared/constants/order";
import { nationalPhoneDigits } from "@shared/lib/phone";
import { CUSTOMER_SUGGESTION_QUERY_KEY } from "@/constants/api";
import { CUSTOMER_SUGGESTION_DEBOUNCE_MS } from "@/constants/pos";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fetchCustomerSuggestions } from "@/lib/api/orders";

// "Have we served this number before?", asked while the cashier types.
//
// The lookup is on the national digits rather than the whole E.164 value:
// the same Palestine line can be filed under +970 or +972 (CLAUDE.md rule
// 18), and a cashier should never have to guess which prefix a past order
// used. Debounced so a number typed in one burst is one request, and only
// asked once there are enough digits to mean anything — both floors are the
// backend's, which enforces the same minimum.
export function useCustomerSuggestions(phone: string) {
  const digits = nationalPhoneDigits(phone.trim());
  const debounced = useDebouncedValue(digits, CUSTOMER_SUGGESTION_DEBOUNCE_MS);
  const enabled = debounced.length >= CUSTOMER_SUGGESTION_MIN_DIGITS;

  const result = useQuery({
    queryKey: [...CUSTOMER_SUGGESTION_QUERY_KEY, debounced],
    queryFn: () => fetchCustomerSuggestions(debounced),
    enabled,
    // The list holds still between keystrokes instead of blinking empty —
    // the same reason product search keeps its previous page.
    placeholderData: keepPreviousData,
  });

  return {
    suggestions: enabled ? (result.data ?? []) : [],
    // Typing past the floor with nothing back yet: shown as looking, not as
    // "no matches", so nobody reads a pending request as a new customer.
    isLooking: enabled && (result.isPending || digits !== debounced),
    isActive: enabled,
  };
}
