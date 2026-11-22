"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateSupplierInvoiceInput,
  SupplierPaymentInput,
  UpdateSupplierInput,
  UpdateSupplierInvoiceInput,
} from "@store/shared/schemas/supplier";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import {
  createSupplier,
  createSupplierInvoice,
  deleteSupplierInvoice,
  fetchSupplier,
  fetchSuppliers,
  paySupplier,
  updateSupplier,
  updateSupplierInvoice,
} from "@/lib/api/suppliers";
import {
  SUPPLIER_DETAIL_QUERY_KEY,
  SUPPLIER_LIST_QUERY_KEY,
  SUPPLIER_PAYMENT_PREVIEW_QUERY_KEY,
  SUPPLIER_STALE_TIME_MS,
} from "@/constants/suppliers";
import type { SupplierListFilters } from "@/types/supplier";

export function useSuppliersQuery(filters: SupplierListFilters) {
  return useQuery({
    queryKey: [SUPPLIER_LIST_QUERY_KEY, filters],
    queryFn: () => fetchSuppliers(filters),
    staleTime: SUPPLIER_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

export function useSupplierQuery(id: string) {
  return useQuery({
    queryKey: [SUPPLIER_DETAIL_QUERY_KEY, id],
    queryFn: () => fetchSupplier(id),
    staleTime: SUPPLIER_STALE_TIME_MS,
  });
}

export function useCreateSupplierMutation() {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: createSupplier, onSuccess: (supplier) => suppliersChanged(supplier.id) });
}

export function useUpdateSupplierMutation() {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSupplierInput }) => updateSupplier(id, input),
    onSuccess: (supplier) => suppliersChanged(supplier.id),
  });
}

export function useCreateSupplierInvoiceMutation(supplierId: string) {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (input: CreateSupplierInvoiceInput) => createSupplierInvoice(supplierId, input),
    onSuccess: () => suppliersChanged(supplierId),
  });
}

export function useUpdateSupplierInvoiceMutation(supplierId: string) {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: UpdateSupplierInvoiceInput }) =>
      updateSupplierInvoice(supplierId, invoiceId, input),
    onSuccess: () => suppliersChanged(supplierId),
  });
}

export function useDeleteSupplierInvoiceMutation(supplierId: string) {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (invoiceId: string) => deleteSupplierInvoice(supplierId, invoiceId),
    onSuccess: () => suppliersChanged(supplierId),
  });
}

// Preview calls share this function but invalidate nothing: only a saved payment moves money.
export function usePaySupplierMutation(supplierId: string) {
  const { suppliersChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: (input: SupplierPaymentInput) => paySupplier(supplierId, input),
    onSuccess: (result) => {
      if (!result.preview) {
        suppliersChanged(supplierId);
      }
    },
  });
}

// How a payment would be split, without saving; only while the payment modal is open.
export function useSupplierPaymentPreviewQuery(supplierId: string, amount: string | null, invoiceId: string | null) {
  return useQuery({
    queryKey: [SUPPLIER_PAYMENT_PREVIEW_QUERY_KEY, supplierId, amount, invoiceId],
    queryFn: () => paySupplier(supplierId, { amount: amount!, preview: true, ...(invoiceId && { invoiceId }) }),
    enabled: amount !== null,
    staleTime: 0,
    gcTime: 0,
  });
}
