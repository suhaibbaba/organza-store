import type {
  ApprovalRequestInput,
  ApprovalView,
  CheckoutInput,
  CreateReturnInput,
  ReturnView,
  VoidSaleInput,
  CustomerInput,
  CustomerView,
  PaymentInput,
  PaymentReceipt,
  ReceiptData,
  RegisterView,
  SaleSummary,
  SaleView,
  ShiftView,
  StatementRow,
} from '@organza/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@web/modules/catalogue/api';
import { api, newIdempotencyKey } from '@web/shared/lib/api-client';
import { safeStorage } from '@web/shared/lib/safe-storage';

// ------------------------------------------------------------------ tills and shifts

const REGISTER_KEY = 'organza.register';

/** The till this device works on (a per-device convenience, not shared state). */
export const deviceRegister = {
  get: () => safeStorage.get(REGISTER_KEY),
  set: (id: string) => safeStorage.set(REGISTER_KEY, id),
};

export const useRegisters = () =>
  useQuery({ queryKey: ['registers'], queryFn: () => api.get<RegisterView[]>('/registers') });

export const useShift = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['shift', id],
    queryFn: () => api.get<ShiftView>(`/shifts/${id}`),
    enabled: Boolean(id),
  });

export interface ShiftSummaryRow {
  id: string;
  number: string;
  register: string;
  status: ShiftView['status'];
  businessDate: string;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  hasDifference: boolean;
  signedOff: boolean;
}

export const useShifts = (filters: { attention?: boolean; registerId?: string }) =>
  useQuery({
    queryKey: ['shifts', filters],
    queryFn: () =>
      api.get<ShiftSummaryRow[]>('/shifts', {
        attention: filters.attention || undefined,
        registerId: filters.registerId,
      }),
  });

export interface CountInput {
  currency: string;
  amount: string;
  denominations?: Record<string, number>;
}

export function useShiftMutations() {
  const client = useQueryClient();
  const done = (shift: ShiftView) => {
    client.setQueryData(['shift', shift.id], shift);
    void client.invalidateQueries({ queryKey: ['registers'] });
    void client.invalidateQueries({ queryKey: ['shifts'] });
  };
  return {
    open: useMutation({
      mutationFn: (body: { registerId: string; float: CountInput[]; note?: string }) =>
        api.post<ShiftView>('/shifts', body),
      onSuccess: done,
    }),
    count: useMutation({
      mutationFn: (b: { id: string; counts: CountInput[]; note?: string }) =>
        api.post<ShiftView>(`/shifts/${b.id}/count`, { counts: b.counts, note: b.note }),
      onSuccess: done,
    }),
    recount: useMutation({
      mutationFn: (b: { id: string; counts: CountInput[]; note?: string }) =>
        api.post<ShiftView>(`/shifts/${b.id}/recount`, { counts: b.counts, note: b.note }),
      onSuccess: done,
    }),
    close: useMutation({
      mutationFn: (b: {
        id: string;
        drops: { currency: string; amount: string; to: 'SAFE' | 'BANK' }[];
        note?: string;
      }) => api.post<ShiftView>(`/shifts/${b.id}/close`, { drops: b.drops, note: b.note }),
      onSuccess: done,
    }),
    signOff: useMutation({
      mutationFn: (b: { id: string; note: string }) =>
        api.post<ShiftView>(`/shifts/${b.id}/sign-off`, { note: b.note }),
      onSuccess: done,
    }),
    movement: useMutation({
      mutationFn: (b: {
        id: string;
        type: 'PAID_IN' | 'DROP' | 'EXPENSE';
        currency: string;
        amount: string;
        counterpart: string;
        note?: string;
      }) => {
        const { id, ...body } = b;
        return api.post<ShiftView>(`/shifts/${id}/movements`, {
          ...body,
          idempotencyKey: newIdempotencyKey(),
        });
      },
      onSuccess: done,
    }),
    saveRegister: useMutation({
      mutationFn: (b: { id?: string; name: string; isActive?: boolean }) =>
        b.id
          ? api.patch<RegisterView[]>(`/registers/${b.id}`, {
              name: b.name,
              isActive: b.isActive ?? true,
            })
          : api.post<RegisterView[]>('/registers', { name: b.name }),
      onSuccess: (list) => client.setQueryData(['registers'], list),
    }),
  };
}

// ------------------------------------------------------------------ customers

export const useCustomers = (filters: { q?: string; withDebt?: boolean; page?: number }) =>
  useQuery({
    queryKey: ['customers', filters],
    queryFn: () =>
      api.get<Page<CustomerView>>('/customers', {
        q: filters.q || undefined,
        withDebt: filters.withDebt || undefined,
        page: filters.page,
        pageSize: 30,
      }),
    placeholderData: keepPreviousData,
  });

export const useCustomer = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<CustomerView>(`/customers/${id}`),
    enabled: Boolean(id),
  });

export const useStatement = (id: string | undefined) =>
  useQuery({
    queryKey: ['statement', id],
    queryFn: () => api.get<StatementRow[]>(`/customers/${id}/statement`),
    enabled: Boolean(id),
  });

export interface OpenSale {
  id: string;
  number: string;
  createdAt: string;
  total: string;
  mode: 'TAKEN' | 'HELD';
  paid: string;
  open: string;
  receivable: string;
}

export const useOpenSales = (id: string | undefined) =>
  useQuery({
    queryKey: ['open-sales', id],
    queryFn: () => api.get<OpenSale[]>(`/customers/${id}/open-sales`),
    enabled: Boolean(id),
  });

/** Anything that moves a customer's money refreshes their balances, statement and sales. */
function useMoneyInvalidation() {
  const client = useQueryClient();
  return () => {
    for (const key of [
      'customers',
      'customer',
      'statement',
      'open-sales',
      'sales',
      'sale',
      'shift',
      'stock',
      'products',
      'product',
      'approvals',
      'return',
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
}

export function useCustomerMutations() {
  const client = useQueryClient();
  const set = (c: CustomerView) => {
    client.setQueryData(['customer', c.id], c);
    void client.invalidateQueries({ queryKey: ['customers'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: CustomerInput) => api.post<CustomerView>('/customers', body),
      onSuccess: set,
    }),
    update: useMutation({
      mutationFn: (b: { id: string; body: CustomerInput }) =>
        api.patch<CustomerView>(`/customers/${b.id}`, b.body),
      onSuccess: set,
    }),
  };
}

export function useReceivePayment() {
  const refresh = useMoneyInvalidation();
  return useMutation({
    mutationFn: (b: {
      customerId: string;
      idempotencyKey: string;
      shiftId?: string;
      payments: PaymentInput[];
      allocations?: { saleId: string; amount: string }[];
      note?: string;
    }) => {
      const { customerId, ...body } = b;
      return api.post<PaymentReceipt>(`/customers/${customerId}/payments`, body);
    },
    onSuccess: refresh,
  });
}

// ------------------------------------------------------------------ sales

export interface SaleFilters {
  q?: string;
  customerId?: string;
  shiftId?: string;
  state?: 'PAID' | 'PARTLY_PAID' | 'UNPAID' | 'OWED';
  held?: boolean;
  page?: number;
}

export const useSales = (f: SaleFilters) =>
  useQuery({
    queryKey: ['sales', f],
    queryFn: () =>
      api.get<Page<SaleSummary>>('/sales', {
        q: f.q || undefined,
        customerId: f.customerId,
        shiftId: f.shiftId,
        state: f.state,
        held: f.held || undefined,
        page: f.page,
        pageSize: 30,
      }),
    placeholderData: keepPreviousData,
  });

export const useSale = (id: string | undefined) =>
  useQuery({
    queryKey: ['sale', id],
    queryFn: () => api.get<SaleView>(`/sales/${id}`),
    enabled: Boolean(id),
  });

export const fetchReceipt = (id: string) => api.get<ReceiptData>(`/sales/${id}/receipt`);

export function useCheckout() {
  const refresh = useMoneyInvalidation();
  return useMutation({
    mutationFn: (input: CheckoutInput) => api.post<SaleView>('/sales', input),
    onSuccess: refresh,
  });
}

export function useSaleActions() {
  const refresh = useMoneyInvalidation();
  return {
    handover: useMutation({
      mutationFn: (b: {
        id: string;
        lines?: { lineId: string; quantity: number }[];
        acknowledgeOwed?: boolean;
      }) =>
        api.post<SaleView>(`/sales/${b.id}/handover`, {
          idempotencyKey: newIdempotencyKey(),
          lines: b.lines,
          acknowledgeOwed: b.acknowledgeOwed ?? false,
        }),
      onSuccess: refresh,
    }),
    cancelHeld: useMutation({
      mutationFn: (b: {
        id: string;
        outcome: 'REFUND' | 'CREDIT' | 'KEEP_DEPOSIT';
        refundMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER';
        shiftId?: string;
        reason: string;
      }) => {
        const { id, ...body } = b;
        return api.post<SaleView>(`/sales/${id}/cancel-held`, {
          ...body,
          idempotencyKey: newIdempotencyKey(),
        });
      },
      onSuccess: refresh,
    }),
  };
}

export const useReturn = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['return', id],
    queryFn: () => api.get<ReturnView>(`/sales/returns/${id}`),
    enabled: Boolean(id),
  });

/** Returns, exchanges and voids; each call carries its own idempotency key from the caller. */
export function useReturnActions() {
  const refresh = useMoneyInvalidation();
  return {
    create: useMutation({
      mutationFn: (body: CreateReturnInput) => api.post<ReturnView>('/sales/returns', body),
      onSuccess: refresh,
    }),
    voidSale: useMutation({
      mutationFn: ({ saleId, ...body }: VoidSaleInput & { saleId: string }) =>
        api.post<ReturnView>(`/sales/${saleId}/void`, body),
      onSuccess: refresh,
    }),
  };
}

export interface ApprovalPage {
  items: ApprovalView[];
  total: number;
  page: number;
  pageSize: number;
  pending: number;
}

export const useApprovals = (f: { status?: string; page?: number }, poll = false) =>
  useQuery({
    queryKey: ['approvals', f],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(f.page ?? 1), pageSize: '30' });
      if (f.status) q.set('status', f.status);
      return api.get<ApprovalPage>(`/approvals?${q.toString()}`);
    },
    refetchInterval: poll ? 60_000 : false,
  });

export function useApprovalActions() {
  const refresh = useMoneyInvalidation();
  return {
    request: useMutation({
      mutationFn: (body: ApprovalRequestInput) => api.post<ApprovalView>('/approvals', body),
      onSuccess: refresh,
    }),
    approve: useMutation({
      mutationFn: ({ id, note }: { id: string; note?: string }) =>
        api.post<ApprovalView>(`/approvals/${id}/approve`, { note }),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: ({ id, note }: { id: string; note: string }) =>
        api.post<ApprovalView>(`/approvals/${id}/reject`, { note }),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (id: string) => api.post<ApprovalView>(`/approvals/${id}/cancel`, {}),
      onSuccess: refresh,
    }),
  };
}
