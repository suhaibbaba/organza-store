import type {
  CourierSettlementInput,
  CourierSettlementView,
  CourierView,
  CreateOrderInput,
  OrderLineView,
  OrderStatus,
  OrderSummary,
  OrderView,
  PaymentInput,
  SaleSource,
  UpdateOrderInput,
} from '@organza/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '@web/modules/catalogue/api';
import { useRegisters, deviceRegister } from '@web/modules/sales/api';
import { api, newIdempotencyKey } from '@web/shared/lib/api-client';

export interface OrderFilters {
  q?: string;
  status?: OrderStatus;
  open?: boolean;
  source?: SaleSource;
  courierId?: string;
  customerId?: string;
  unsettled?: boolean;
  page?: number;
  pageSize?: number;
}

export const useOrders = (filters: OrderFilters, poll = false) =>
  useQuery({
    queryKey: ['orders', filters],
    queryFn: () =>
      api.get<Page<OrderSummary>>('/orders', {
        ...filters,
        open: filters.open || undefined,
        unsettled: filters.unsettled || undefined,
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 50,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: poll ? 30_000 : false,
  });

export const useOrder = (id: string | undefined) =>
  useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderView>(`/orders/${id}`),
    enabled: Boolean(id),
  });

export type PickLine = OrderLineView & { orderId: string; orderNumber: string };

export const usePickList = (ids: string[]) =>
  useQuery({
    queryKey: ['pick-list', ids],
    queryFn: () => api.get<PickLine[]>('/orders/pick-list', { ids: ids.join(',') }),
    enabled: ids.length > 0,
  });

/** The open shift on this device's till, or any open shift (cash needs one). */
export function useOpenShiftId() {
  const registers = useRegisters();
  const deviceId = deviceRegister.get();
  return (
    (registers.data ?? []).find((r) => r.id === deviceId)?.openShift?.id ??
    (registers.data ?? []).find((r) => r.openShift)?.openShift?.id
  );
}

export function useOrderActions() {
  const client = useQueryClient();
  const done = (order: OrderView) => {
    client.setQueryData(['order', order.id], order);
    void client.invalidateQueries({ queryKey: ['orders'] });
    void client.invalidateQueries({ queryKey: ['couriers'] });
    void client.invalidateQueries({ queryKey: ['sales'] });
    void client.invalidateQueries({ queryKey: ['customer'] });
    void client.invalidateQueries({ queryKey: ['products'] });
  };
  const useAction = <I>(fn: (input: I) => Promise<OrderView>) =>
    useMutation({ mutationFn: fn, onSuccess: done });
  return {
    create: useAction((input: CreateOrderInput) => api.post<OrderView>('/orders', input)),
    update: useAction((input: { id: string; body: UpdateOrderInput }) =>
      api.patch<OrderView>(`/orders/${input.id}`, input.body),
    ),
    step: useAction(
      (input: { id: string; step: 'confirm' | 'prepare' | 'ready' | 'reserve'; note?: string }) =>
        api.post<OrderView>(`/orders/${input.id}/${input.step}`, { note: input.note }),
    ),
    cancel: useAction((input: { id: string; reason: string }) =>
      api.post<OrderView>(`/orders/${input.id}/cancel`, { reason: input.reason }),
    ),
    ship: useAction((input: { id: string; courierId?: string; shiftId?: string }) =>
      api.post<OrderView>(`/orders/${input.id}/ship`, {
        idempotencyKey: newIdempotencyKey(),
        courierId: input.courierId,
        shiftId: input.shiftId,
      }),
    ),
    collect: useAction(
      (input: {
        id: string;
        key: string;
        shiftId?: string;
        payments: PaymentInput[];
        overpayment?: 'CHANGE' | 'CREDIT';
      }) =>
        api.post<OrderView>(`/orders/${input.id}/collect`, {
          idempotencyKey: input.key,
          shiftId: input.shiftId,
          payments: input.payments,
          overpayment: input.overpayment,
        }),
    ),
    returned: useAction(
      (input: {
        id: string;
        key: string;
        shiftId?: string;
        reason: string;
        lines: { lineId: string; condition: 'SHELF' | 'DAMAGED' }[];
      }) =>
        api.post<OrderView>(`/orders/${input.id}/returned`, {
          idempotencyKey: input.key,
          shiftId: input.shiftId,
          reason: input.reason,
          lines: input.lines,
        }),
    ),
    deposit: useAction(
      (input: { id: string; key: string; shiftId?: string; payment: PaymentInput }) =>
        api.post<OrderView>(`/orders/${input.id}/deposits`, {
          idempotencyKey: input.key,
          shiftId: input.shiftId,
          payment: input.payment,
        }),
    ),
  };
}

// ------------------------------------------------------------------ couriers

export const useCouriers = () =>
  useQuery({ queryKey: ['couriers'], queryFn: () => api.get<CourierView[]>('/couriers') });

export const useSettlements = (courierId: string | null) =>
  useQuery({
    queryKey: ['couriers', courierId, 'settlements'],
    queryFn: () => api.get<CourierSettlementView[]>(`/couriers/${courierId}/settlements`),
    enabled: Boolean(courierId),
  });

export function useCourierActions() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['couriers'] });
    void client.invalidateQueries({ queryKey: ['orders'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: { name: string; phone?: string; note?: string }) =>
        api.post<CourierView>('/couriers', body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (input: {
        id: string;
        body: { name?: string; phone?: string; note?: string; isActive?: boolean };
      }) => api.patch<CourierView>(`/couriers/${input.id}`, input.body),
      onSuccess: refresh,
    }),
    settle: useMutation({
      mutationFn: (input: { courierId: string; body: CourierSettlementInput }) =>
        api.post<CourierSettlementView>(`/couriers/${input.courierId}/settlements`, input.body),
      onSuccess: refresh,
    }),
  };
}
