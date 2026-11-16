import {
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import type { ProductSummary } from '@organza/shared';
import { IconChevronDown, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useBarcodeScanner } from '@web/shared/hooks/use-barcode-scanner';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { notifications } from '@mantine/notifications';
import { lookupCode, type ProductFilters, useCategories, useProducts } from './api';
import { ProductThumb, StatusBadge, StockBadge, useLocalized, useMoney } from './components';
import classes from './catalogue.module.css';

const PAGE_SIZE = 30;

export function ProductsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 48em)');
  const localized = useLocalized();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 300);
  const [filters, setFilters] = useState<ProductFilters>({ status: 'ACTIVE', page: 1 });
  const query = useProducts({ ...filters, q: debounced, pageSize: PAGE_SIZE });
  const set = (patch: Partial<ProductFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const open = (p: Pick<ProductSummary, 'id'>) => navigate(`/products/${p.id}`);

  useBarcodeScanner((code) => {
    lookupCode(code).then(
      (hit) => navigate(`/products/${hit.productId}`),
      (error: unknown) => notifications.show({ color: 'red', message: errorMessage(error) }),
    );
  });

  const price = (p: ProductSummary) =>
    p.minPrice === p.maxPrice ? money(p.minPrice) : `${money(p.minPrice)} – ${money(p.maxPrice)}`;
  const total = query.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title={t('catalogue.products')}
        primary={
          can('products.create') && (
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  leftSection={<IconPlus size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                >
                  {t('catalogue.newProduct')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {(['REGULAR', 'VARIANT', 'NUMBERED'] as const).map((type) => (
                  <Menu.Item
                    key={type}
                    onClick={() => navigate(`/products/new/${type.toLowerCase()}`)}
                  >
                    <Text size="sm" fw={600}>
                      {t(`catalogue.type.${type}`)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t(`catalogue.typeHint.${type}`)}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )
        }
      />
      <div className={classes.filters}>
        <TextInput
          className={classes.search}
          leftSection={<IconSearch size={16} />}
          placeholder={t('catalogue.searchHint')}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          type="search"
        />
        <Select
          w={180}
          clearable
          placeholder={t('catalogue.category')}
          data={(categories.data ?? []).map((c) => ({ value: c.id, label: localized(c.name) }))}
          value={filters.categoryId ?? null}
          onChange={(v) => set({ categoryId: v })}
        />
        <Select
          w={150}
          clearable
          placeholder={t('catalogue.productType')}
          data={(['REGULAR', 'VARIANT', 'NUMBERED'] as const).map((v) => ({
            value: v,
            label: t(`catalogue.type.${v}`),
          }))}
          value={filters.type ?? null}
          onChange={(v) => set({ type: v as ProductFilters['type'] })}
        />
      </div>
      <Group gap="md" mb="md" wrap="wrap">
        {can('products.hide') && (
          <SegmentedControl
            size="xs"
            value={filters.status ?? 'ACTIVE'}
            onChange={(v) => set({ status: v as ProductFilters['status'] })}
            data={(['ACTIVE', 'HIDDEN', 'ARCHIVED', 'ALL'] as const).map((s) => ({
              value: s,
              label: t(`catalogue.status.${s}`),
            }))}
          />
        )}
        <Checkbox
          size="xs"
          label={t('catalogue.lowStock')}
          checked={Boolean(filters.lowStock)}
          onChange={(e) => set({ lowStock: e.currentTarget.checked })}
        />
        <Checkbox
          size="xs"
          label={t('catalogue.needsCompletion')}
          checked={Boolean(filters.needsCompletion)}
          onChange={(e) => set({ needsCompletion: e.currentTarget.checked })}
        />
        <Checkbox
          size="xs"
          label={t('catalogue.labelsPending')}
          checked={Boolean(filters.labelsPending)}
          onChange={(e) => set({ labelsPending: e.currentTarget.checked })}
        />
      </Group>

      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.items.length === 0 && <EmptyState />}
      {query.data && query.data.items.length > 0 && phone && (
        <Stack gap="xs">
          {query.data.items.map((p) => (
            <Card
              key={p.id}
              withBorder
              padding="xs"
              onClick={() => open(p)}
              className={classes.row}
            >
              <Group wrap="nowrap" align="flex-start">
                <ProductThumb url={p.thumbnailUrl} />
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {localized(p.name)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    #{p.number} · {t(`catalogue.type.${p.type}`)}
                  </Text>
                  <Group gap={6}>
                    <Text size="sm">{price(p)}</Text>
                    <StockBadge available={p.available} low={p.lowStock} />
                    {p.status !== 'ACTIVE' && <StatusBadge status={p.status} />}
                  </Group>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {query.data && query.data.items.length > 0 && !phone && (
        <Card p={0}>
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing={6} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={60} />
                  <Table.Th>{t('catalogue.name')}</Table.Th>
                  <Table.Th>{t('catalogue.number')}</Table.Th>
                  <Table.Th>{t('catalogue.productType')}</Table.Th>
                  <Table.Th>{t('catalogue.price')}</Table.Th>
                  <Table.Th>{t('catalogue.stock')}</Table.Th>
                  <Table.Th>{t('catalogue.statusLabel')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((p) => (
                  <Table.Tr key={p.id} onClick={() => open(p)} className={classes.row}>
                    <Table.Td>
                      <ProductThumb url={p.thumbnailUrl} size={32} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {localized(p.name)}
                      </Text>
                      {p.needsCompletion && (
                        <Text size="xs" c="orange">
                          {t('catalogue.needsCompletion')}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>#{p.number}</Table.Td>
                    <Table.Td>{t(`catalogue.type.${p.type}`)}</Table.Td>
                    <Table.Td>{price(p)}</Table.Td>
                    <Table.Td>
                      <StockBadge available={p.available} low={p.lowStock} />
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={p.status} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {total > PAGE_SIZE && (
        <Group justify="center" mt="md">
          <Pagination
            total={Math.ceil(total / PAGE_SIZE)}
            value={filters.page ?? 1}
            onChange={(page) => setFilters((f) => ({ ...f, page }))}
            size="sm"
          />
        </Group>
      )}
    </>
  );
}
