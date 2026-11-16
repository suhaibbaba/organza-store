import type { Currency, ShopSettings, UpdateShopSettingsInput } from '@organza/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@web/shared/lib/api-client';

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<ShopSettings>('/settings'),
    staleTime: 60_000,
  });

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateShopSettingsInput) => api.patch<ShopSettings>('/settings', input),
    onSuccess: (data) => client.setQueryData(['settings'], data),
  });
}

export const useCurrencies = () =>
  useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get<Currency[]>('/currencies'),
    staleTime: 60_000,
  });

/** The currency every price and debt is kept in. */
export function useDefaultCurrency(): string {
  return useCurrencies().data?.find((c) => c.isDefault)?.code ?? 'ILS';
}

export function useCurrencyMutations() {
  const client = useQueryClient();
  const done = () => client.invalidateQueries({ queryKey: ['currencies'] });
  return {
    create: useMutation({
      mutationFn: (input: { code: string; rate: string }) => api.post('/currencies', input),
      onSuccess: done,
    }),
    setRate: useMutation({
      mutationFn: (input: { code: string; rate: string }) =>
        api.put(`/currencies/${input.code}/rate`, { rate: input.rate }),
      onSuccess: done,
    }),
    setActive: useMutation({
      mutationFn: (input: { code: string; isActive: boolean }) =>
        api.patch(`/currencies/${input.code}`, { isActive: input.isActive }),
      onSuccess: done,
    }),
  };
}
