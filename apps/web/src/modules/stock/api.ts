import type {
  CountView,
  CreateAdjustmentInput,
  MovementRow,
  ProductView,
  StockRow,
} from '@organza/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@web/shared/lib/api-client';
import { lookupCode, type Page } from '@web/modules/catalogue/api';

export interface StockFilters {
  q?: string;
  categoryId?: string | null;
  lowStock?: boolean;
  damaged?: boolean;
  page?: number;
  pageSize?: number;
}

export const useStock = (f: StockFilters) =>
  useQuery({
    queryKey: ['stock', f],
    queryFn: () =>
      api.get<Page<StockRow>>('/stock', {
        q: f.q,
        categoryId: f.categoryId,
        lowStock: f.lowStock || undefined,
        damaged: f.damaged || undefined,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });

export const useItemHistory = (itemId: string | null) =>
  useQuery({
    queryKey: ['stock-history', itemId],
    queryFn: () => api.get<MovementRow[]>(`/stock/items/${itemId}/history`),
    enabled: Boolean(itemId),
  });

export interface AdjustmentSummary {
  id: string;
  number: string;
  reason: string;
  note: string | null;
  createdAt: string;
  lineCount: number;
  units: number;
  reversed: boolean;
}

export interface AdjustmentDetail {
  id: string;
  number: string;
  reason: string;
  note: string | null;
  createdAt: string;
  reversed: boolean;
  lines: {
    itemId: string;
    sku: string;
    name: Record<string, string>;
    delta: number;
    countedQuantity: number | null;
    previousQuantity: number;
    bucket: string;
  }[];
}

export const useAdjustments = () =>
  useQuery({
    queryKey: ['adjustments'],
    queryFn: () => api.get<AdjustmentSummary[]>('/stock/adjustments'),
  });
export const useAdjustment = (id: string | null) =>
  useQuery({
    queryKey: ['adjustment', id],
    queryFn: () => api.get<AdjustmentDetail>(`/stock/adjustments/${id}`),
    enabled: Boolean(id),
  });

function useStockMutation<I, O>(fn: (input: I) => Promise<O>, extraKeys: string[] = []) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of ['stock', 'products', 'product', 'stock-history', ...extraKeys])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
}

export const useCreateAdjustment = () =>
  useStockMutation(
    (input: CreateAdjustmentInput) => api.post<AdjustmentDetail>('/stock/adjustments', input),
    ['adjustments'],
  );
export const useReverseAdjustment = () =>
  useStockMutation(
    (input: { id: string; reason: string }) =>
      api.post<AdjustmentDetail>(`/stock/adjustments/${input.id}/reverse`, {
        reason: input.reason,
      }),
    ['adjustments', 'adjustment'],
  );

export interface CountSummary {
  id: string;
  number: string;
  title: string;
  status: 'OPEN' | 'POSTED' | 'CANCELLED';
  createdAt: string;
  postedAt: string | null;
}

export const useCounts = () =>
  useQuery({ queryKey: ['counts'], queryFn: () => api.get<CountSummary[]>('/stock/counts') });
export const useCount = (id: string | undefined) =>
  useQuery({
    queryKey: ['count', id],
    queryFn: () => api.get<CountView>(`/stock/counts/${id}`),
    enabled: Boolean(id),
  });

export function useCountMutations(id?: string) {
  const client = useQueryClient();
  const set = (data: CountView) => {
    client.setQueryData(['count', data.id], data);
    void client.invalidateQueries({ queryKey: ['counts'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: { title: string; note?: string }) =>
        api.post<CountView>('/stock/counts', body),
      onSuccess: set,
    }),
    lines: useMutation({
      mutationFn: (lines: { itemId: string; counted: number }[]) =>
        api.post<CountView>(`/stock/counts/${id}/lines`, { lines }),
      onSuccess: set,
    }),
    post: useStockMutation(
      () => api.post<CountView>(`/stock/counts/${id}/post`),
      ['counts', 'count'],
    ),
    cancel: useMutation({
      mutationFn: () => api.post<CountView>(`/stock/counts/${id}/cancel`),
      onSuccess: set,
    }),
  };
}

export interface PickedItem {
  itemId: string;
  productId: string;
  sku: string;
  name: Record<string, string | undefined>;
  options: string[];
  onHand: number;
  damaged: number;
}

/** A scanned code becomes an item, or the product's items to choose from (shared supplier code). */
export async function resolveScan(
  code: string,
  label: (p: ProductView, itemId: string) => string[],
): Promise<PickedItem[]> {
  const hit = await lookupCode(code);
  const product = await api.get<ProductView>(`/products/${hit.productId}`);
  const toPicked = (item: ProductView['items'][number]): PickedItem => ({
    itemId: item.id,
    productId: product.id,
    sku: item.sku,
    name: product.name,
    options: label(product, item.id),
    onHand: item.stock.onHand,
    damaged: item.stock.damaged,
  });
  const items = product.items.filter((i) => !i.archivedAt);
  if (hit.itemId) return items.filter((i) => i.id === hit.itemId).map(toPicked);
  return items.map(toPicked);
}
