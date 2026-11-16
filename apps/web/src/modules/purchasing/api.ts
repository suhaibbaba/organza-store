import type {
  CreateCreditNoteInput,
  CreatePurchaseOrderInput,
  CreateReceiptInput,
  CreditNoteView,
  ItemCostRow,
  PurchaseOrderSummary,
  PurchaseOrderView,
  ReceiptSummary,
  ReceiptView,
  SupplierInput,
  SupplierPayInput,
  SupplierPaymentView,
  SupplierStatementRow,
  SupplierView,
} from '@organza/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@web/modules/catalogue/api';
import { api } from '@web/shared/lib/api-client';

export const useSuppliers = (filters: { q?: string; owed?: boolean; active?: boolean } = {}) =>
  useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () =>
      api.get<SupplierView[]>('/suppliers', {
        q: filters.q || undefined,
        owed: filters.owed || undefined,
        active: filters.active,
      }),
    placeholderData: keepPreviousData,
  });

export const useSupplier = (id: string | undefined) =>
  useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get<SupplierView>(`/suppliers/${id}`),
    enabled: Boolean(id),
  });

export const useStatement = (id: string) =>
  useQuery({
    queryKey: ['supplier', id, 'statement'],
    queryFn: () => api.get<SupplierStatementRow[]>(`/suppliers/${id}/statement`),
  });

export const useSupplierPayments = (id: string) =>
  useQuery({
    queryKey: ['supplier', id, 'payments'],
    queryFn: () => api.get<SupplierPaymentView[]>(`/suppliers/${id}/payments`),
  });

export const useCreditNotes = (id: string) =>
  useQuery({
    queryKey: ['supplier', id, 'credit-notes'],
    queryFn: () => api.get<CreditNoteView[]>(`/suppliers/${id}/credit-notes`),
  });

export const useReceipts = (filters: {
  supplierId?: string;
  open?: boolean;
  page?: number;
  pageSize?: number;
}) =>
  useQuery({
    queryKey: ['receipts', filters],
    queryFn: () =>
      api.get<Page<ReceiptSummary>>('/purchasing/receipts', {
        ...filters,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 50,
      }),
    placeholderData: keepPreviousData,
  });

export const useReceipt = (id: string | undefined) =>
  useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptView>(`/purchasing/receipts/${id}`),
    enabled: Boolean(id),
  });

export const usePurchaseOrders = (filters: {
  supplierId?: string;
  open?: boolean;
  page?: number;
  pageSize?: number;
}) =>
  useQuery({
    queryKey: ['purchase-orders', filters],
    queryFn: () =>
      api.get<Page<PurchaseOrderSummary>>('/purchasing/orders', {
        ...filters,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 50,
      }),
    placeholderData: keepPreviousData,
  });

export const usePurchaseOrder = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get<PurchaseOrderView>(`/purchasing/orders/${id}`),
    enabled: Boolean(id),
  });

export const useItemCosts = (itemId: string | null) =>
  useQuery({
    queryKey: ['item-costs', itemId],
    queryFn: () => api.get<ItemCostRow[]>(`/purchasing/items/${itemId}/costs`),
    enabled: Boolean(itemId),
  });

export function usePurchasingActions() {
  const client = useQueryClient();
  const done = () => {
    for (const key of [
      'suppliers',
      'supplier',
      'receipts',
      'receipt',
      'purchase-orders',
      'purchase-order',
      'products',
      'stock',
      'shift',
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const useAction = <I, O>(fn: (input: I) => Promise<O>) =>
    useMutation({ mutationFn: fn, onSuccess: done });
  return {
    createSupplier: useAction((input: SupplierInput) =>
      api.post<SupplierView>('/suppliers', input),
    ),
    updateSupplier: useAction((input: { id: string; body: Partial<SupplierInput> }) =>
      api.patch<SupplierView>(`/suppliers/${input.id}`, input.body),
    ),
    pay: useAction((input: { supplierId: string; body: SupplierPayInput }) =>
      api.post<SupplierPaymentView>(`/suppliers/${input.supplierId}/payments`, input.body),
    ),
    receive: useAction((input: CreateReceiptInput) =>
      api.post<ReceiptView>('/purchasing/receipts', input),
    ),
    createOrder: useAction((input: CreatePurchaseOrderInput) =>
      api.post<PurchaseOrderView>('/purchasing/orders', input),
    ),
    closeOrder: useAction(
      (input: { id: string; outcome: 'CLOSED' | 'CANCELLED'; reason: string }) =>
        api.post<PurchaseOrderView>(`/purchasing/orders/${input.id}/close`, {
          outcome: input.outcome,
          reason: input.reason,
        }),
    ),
    creditNote: useAction((input: CreateCreditNoteInput) =>
      api.post<CreditNoteView>('/purchasing/credit-notes', input),
    ),
  };
}
