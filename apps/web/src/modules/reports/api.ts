import type {
  ActivityItem,
  CashReport,
  DailySummary,
  DebtsReport,
  ExpenseRow,
  InventoryValuation,
  PaymentMethodRow,
  ProfitAndLoss,
  ReportRange,
  SalesGroup,
  SalesReportRow,
  SupplierDebtsReport,
  TodayView,
} from '@organza/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@web/shared/lib/api-client';

const useReport = <T>(path: string, params: Record<string, string | undefined> = {}) =>
  useQuery({
    queryKey: ['report', path, params],
    queryFn: () => api.get<T>(path, params),
    placeholderData: keepPreviousData,
  });

export const useToday = () =>
  useQuery({
    queryKey: ['today'],
    queryFn: () => api.get<TodayView>('/dashboard/today'),
    refetchInterval: 60_000,
  });

export const useActivity = (limit = 30) =>
  useQuery({
    queryKey: ['activity', limit],
    queryFn: () => api.get<ActivityItem[]>('/activity', { limit }),
    refetchInterval: 60_000,
  });

export const useProfitAndLoss = (r: ReportRange) =>
  useReport<ProfitAndLoss>('/reports/profit-and-loss', r);
export const useSalesReport = (r: ReportRange, groupBy: SalesGroup) =>
  useReport<SalesReportRow[]>('/reports/sales', { ...r, groupBy });
export const useCashReport = (r: ReportRange) => useReport<CashReport>('/reports/cash', r);
export const usePaymentMethods = (r: ReportRange) =>
  useReport<PaymentMethodRow[]>('/reports/payment-methods', r);
export const useExpensesReport = (r: ReportRange) =>
  useReport<ExpenseRow[]>('/reports/expenses', r);
export const useDebts = () => useReport<DebtsReport>('/reports/debts');
export const useSupplierDebts = () => useReport<SupplierDebtsReport>('/reports/supplier-debts');
export const useInventory = () => useReport<InventoryValuation>('/reports/inventory');
export const useDaily = (date: string) => useReport<DailySummary>('/reports/daily', { date });
