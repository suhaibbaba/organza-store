import type {
  CreateProductInput,
  ImageEdit,
  ImageView,
  LabelData,
  ProductSummary,
  ProductView,
  UpdateProductInput,
} from '@organza/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@web/shared/lib/api-client';
import type { Translations } from '@web/shared/components/TranslatableInput';

export interface Category {
  id: string;
  name: Translations;
  slug: string;
  parentId: string | null;
  isFavorite: boolean;
  sortOrder: number;
  archivedAt: string | null;
}

export interface OptionValue {
  id: string;
  typeId: string;
  key: string;
  value: Translations;
  sortOrder: number;
}

export interface OptionType {
  id: string;
  key: string;
  name: Translations;
  sortOrder: number;
  values: OptionValue[];
}

export interface ProductFilters {
  q?: string;
  categoryId?: string | null;
  status?: 'ACTIVE' | 'HIDDEN' | 'ARCHIVED' | 'ALL';
  type?: 'REGULAR' | 'VARIANT' | 'NUMBERED' | null;
  lowStock?: boolean;
  needsCompletion?: boolean;
  labelsPending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const catalogueKeys = {
  categories: ['categories'] as const,
  options: ['option-types'] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (id: string) => ['product', id] as const,
};

export const useCategories = () =>
  useQuery({
    queryKey: catalogueKeys.categories,
    queryFn: () => api.get<Category[]>('/categories'),
    staleTime: 60_000,
  });

export const useOptionTypes = () =>
  useQuery({
    queryKey: catalogueKeys.options,
    queryFn: () => api.get<OptionType[]>('/option-types'),
    staleTime: 60_000,
  });

export const useProducts = (filters: ProductFilters) =>
  useQuery({
    queryKey: catalogueKeys.products(filters),
    queryFn: () =>
      api.get<Page<ProductSummary>>('/products', {
        q: filters.q,
        categoryId: filters.categoryId,
        status: filters.status,
        type: filters.type,
        lowStock: filters.lowStock || undefined,
        needsCompletion: filters.needsCompletion || undefined,
        labelsPending: filters.labelsPending || undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: catalogueKeys.product(id ?? ''),
    queryFn: () => api.get<ProductView>(`/products/${id}`),
    enabled: Boolean(id),
  });

export const lookupCode = (code: string) =>
  api.get<{ code: string; productId: string; itemId: string | null }>(
    `/products/lookup/${encodeURIComponent(code)}`,
  );

/** Every catalogue write refreshes lists and the product it touched. */
function useCatalogueMutation<I, O>(
  fn: (input: I) => Promise<O>,
  productId?: (input: I, output: O) => string | undefined,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (output, input) => {
      void client.invalidateQueries({ queryKey: ['products'] });
      const id = productId?.(input, output);
      if (id && output && typeof output === 'object' && 'items' in output)
        client.setQueryData(catalogueKeys.product(id), output);
      else if (id) void client.invalidateQueries({ queryKey: catalogueKeys.product(id) });
    },
  });
}

export const useCreateProduct = () =>
  useCatalogueMutation(
    (input: CreateProductInput) => api.post<ProductView>('/products', input),
    (_i, o) => o.id,
  );

export const useReviewQuickSell = () =>
  useCatalogueMutation(
    (input: { id: string; version: number; outcome: 'COMPLETED' | 'ONE_OFF' }) =>
      api.post<ProductView>(`/products/${input.id}/quick-sell-review`, {
        version: input.version,
        outcome: input.outcome,
      }),
    (i) => i.id,
  );

export const useUpdateProduct = () =>
  useCatalogueMutation(
    (input: { id: string; body: UpdateProductInput }) =>
      api.patch<ProductView>(`/products/${input.id}`, input.body),
    (i) => i.id,
  );

export const useArchiveProduct = () =>
  useCatalogueMutation(
    (input: { id: string; stock: 'WRITE_OFF' | 'KEEP'; reason?: string }) =>
      api.post<ProductView>(`/products/${input.id}/archive`, {
        stock: input.stock,
        reason: input.reason,
      }),
    (i) => i.id,
  );

export const useAddItems = () =>
  useCatalogueMutation(
    (input: { id: string; body: Record<string, unknown> }) =>
      api.post<ProductView>(`/products/${input.id}/items`, input.body),
    (i) => i.id,
  );

export const useAddBarcode = () =>
  useCatalogueMutation(
    (input: { productId: string; code: string; itemId?: string }) =>
      api.post<ProductView>(`/products/${input.productId}/barcodes`, {
        code: input.code,
        itemId: input.itemId,
      }),
    (i) => i.productId,
  );

export const useUpdateItem = () =>
  useCatalogueMutation(
    (input: { productId: string; itemId: string; body: Record<string, unknown> }) =>
      api.patch(`/items/${input.itemId}`, input.body),
    (i) => i.productId,
  );

export const useSetCost = () =>
  useCatalogueMutation(
    (input: { productId: string; itemId: string; cost: string }) =>
      api.post<ProductView>(`/items/${input.itemId}/cost`, { cost: input.cost }),
    (i) => i.productId,
  );

export function uploadImage(
  file: Blob,
  options: { productId?: string; itemId?: string; edit?: ImageEdit } = {},
) {
  const form = new FormData();
  if (options.productId) form.append('productId', options.productId);
  if (options.itemId) form.append('itemId', options.itemId);
  if (options.edit) form.append('edit', JSON.stringify(options.edit));
  form.append('file', file, 'photo');
  return api.post<ImageView>('/images', form);
}

export const useImageMutations = (productId?: string) => {
  const client = useQueryClient();
  const refresh = () =>
    productId && client.invalidateQueries({ queryKey: catalogueKeys.product(productId) });
  return {
    upload: useMutation({
      mutationFn: (input: { file: Blob; edit?: ImageEdit }) =>
        uploadImage(input.file, {
          ...(productId && { productId }),
          ...(input.edit && { edit: input.edit }),
        }),
      onSuccess: refresh,
    }),
    recrop: useMutation({
      mutationFn: (input: { id: string; edit: ImageEdit }) =>
        api.post<ImageView>(`/images/${input.id}/crop`, input.edit),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/images/${id}`),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (imageIds: string[]) =>
        api.post<ImageView[]>(`/products/${productId}/images/order`, { imageIds }),
      onSuccess: refresh,
    }),
  };
};

export function useCatalogueAdmin() {
  const client = useQueryClient();
  const cats = () => client.invalidateQueries({ queryKey: catalogueKeys.categories });
  const opts = () => client.invalidateQueries({ queryKey: catalogueKeys.options });
  return {
    createCategory: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post<Category>('/categories', body),
      onSuccess: cats,
    }),
    updateCategory: useMutation({
      mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
        api.patch<Category>(`/categories/${input.id}`, input.body),
      onSuccess: cats,
    }),
    createOptionType: useMutation({
      mutationFn: (body: Record<string, unknown>) => api.post('/option-types', body),
      onSuccess: opts,
    }),
    createOptionValue: useMutation({
      mutationFn: (input: { typeId: string; value: Translations }) =>
        api.post<OptionValue>(`/option-types/${input.typeId}/values`, { value: input.value }),
      onSuccess: opts,
    }),
    updateOptionValue: useMutation({
      mutationFn: (input: { id: string; body: Record<string, unknown> }) =>
        api.patch(`/option-values/${input.id}`, input.body),
      onSuccess: opts,
    }),
  };
}

export const fetchLabels = (ids: { productIds?: string[]; itemIds?: string[] }) =>
  api.get<LabelData[]>('/labels', {
    productIds: ids.productIds?.join(','),
    itemIds: ids.itemIds?.join(','),
  });

export const markLabelsPrinted = (productIds: string[]) =>
  api.post('/labels/printed', { productIds });
