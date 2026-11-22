"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { CustomerPaymentInput, RecordPaymentInput, UpdateCustomerInput } from "@store/shared/schemas/customer";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import {
  createCustomer,
  fetchCustomer,
  fetchCustomers,
  handOverItems,
  payCustomer,
  recordOrderPayment,
  updateCustomer,
} from "@/lib/api/customers";
import {
  CUSTOMER_DETAIL_QUERY_KEY,
  CUSTOMER_LIST_QUERY_KEY,
  CUSTOMER_PAYMENT_PREVIEW_QUERY_KEY,
  CUSTOMER_STALE_TIME_MS,
} from "@/constants/customers";
import type { CustomerListFilters } from "@/types/customer";

export function useCustomersQuery(filters: CustomerListFilters, enabled = true) {
  return useQuery({
    queryKey: [CUSTOMER_LIST_QUERY_KEY, filters],
    queryFn: () => fetchCustomers(filters),
    staleTime: CUSTOMER_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCustomerQuery(id: string | null) {
  return useQuery({
    queryKey: [CUSTOMER_DETAIL_QUERY_KEY, id],
    queryFn: () => fetchCustomer(id!),
    staleTime: CUSTOMER_STALE_TIME_MS,
    enabled: Boolean(id),
  });
}

export function useCreateCustomerMutation() {
  const { customersChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: createCustomer, onSuccess: (customer) => customersChanged(customer.id) });
}

export function useUpdateCustomerMutation() {
  const { customersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCustomerInput }) => updateCustomer(id, input),
    onSuccess: (customer) => customersChanged(customer.id),
  });
}

// Preview calls share this function but must not invalidate anything: only a saved payment moves money.
export function usePayCustomerMutation(customerId: string) {
  const { customersChanged, ordersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (input: CustomerPaymentInput) => payCustomer(customerId, input),
    onSuccess: (result) => {
      if (!result.preview) {
        customersChanged(customerId);
        ordersChanged(result.allocations.map((allocation) => allocation.orderId));
      }
    },
  });
}

export function useRecordOrderPaymentMutation(orderId: string) {
  const { customersChanged, ordersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => recordOrderPayment(orderId, input),
    onSuccess: (order) => {
      ordersChanged(orderId);
      customersChanged(order.customerId ?? undefined);
    },
  });
}

export function useHandOverItemsMutation() {
  const { customersChanged, ordersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ orderId, itemIds }: { orderId: string; itemIds: string[] }) => handOverItems(orderId, { itemIds }),
    onSuccess: (order) => {
      ordersChanged(order.id);
      customersChanged(order.customerId ?? undefined);
    },
  });
}

// Asks how a payment would be split, without saving; only while the payment modal is open.
export function useCustomerPaymentPreviewQuery(customerId: string, amount: string | null) {
  return useQuery({
    queryKey: [CUSTOMER_PAYMENT_PREVIEW_QUERY_KEY, customerId, amount],
    queryFn: () => payCustomer(customerId, { amount: amount!, preview: true }),
    enabled: amount !== null,
    staleTime: 0,
    gcTime: 0,
  });
}
