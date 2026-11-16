import {
  Badge,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import type { SaleSummary } from '@organza/shared';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { formatDateTime } from '@web/shared/lib/format';
import { type SaleFilters, useSales } from './api';
import classes from '../catalogue/catalogue.module.css';

export const PAYMENT_STATE_COLORS = {
  PAID: 'green',
  PARTLY_PAID: 'orange',
  UNPAID: 'red',
} as const;

type View = 'all' | 'owed' | 'held';

export function SalesPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 250);
  const [view, setView] = useState<View>('all');
  const [page, setPage] = useState(1);
  const filters: SaleFilters = {
    q: debounced,
    page,
    held: view === 'held' || undefined,
    state: view === 'owed' ? 'OWED' : undefined,
  };
  const query = useSales(filters);
  const pages = query.data ? Math.ceil(query.data.total / query.data.pageSize) : 1;
  return (
    <>
      <PageHeader title={t('nav.sales')} />
      <div className={classes.filters}>
        <TextInput
          className={classes.search}
          leftSection={<IconSearch size={16} />}
          placeholder={t('sales.searchHint')}
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
        />
        <SegmentedControl
          value={view}
          onChange={(v) => {
            setView(v as View);
            setPage(1);
          }}
          data={[
            { value: 'all', label: t('sales.all') },
            { value: 'owed', label: t('sales.owedFilter') },
            { value: 'held', label: t('sales.heldGoods') },
          ]}
        />
      </div>
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.items.length === 0 && <EmptyState />}
      <SaleList sales={query.data?.items ?? []} />
      {pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={page} onChange={setPage} total={pages} />
        </Group>
      )}
    </>
  );
}

export function SaleList({ sales }: { sales: SaleSummary[] }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const navigate = useNavigate();
  return (
    <Stack gap="xs" className="o-list">
      {sales.map((s) => (
        <Card
          key={s.id}
          withBorder
          padding="sm"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sales/${s.id}`)}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap={6}>
                <Text fw={600} dir="ltr">
                  {s.number}
                </Text>
                {s.customer && <Text truncate>{s.customer.name}</Text>}
              </Group>
              <Text size="xs" c="dimmed">
                {formatDateTime(s.createdAt, i18n.language)} ·{' '}
                {t('pos.items', { count: s.itemCount })}
              </Text>
              <Group gap={4}>
                {s.status !== 'COMPLETED' && (
                  <Badge size="xs" color="gray">
                    {t(`sales.status.${s.status}`)}
                  </Badge>
                )}
                {s.mode === 'HELD' && s.status === 'COMPLETED' && (
                  <Badge size="xs" color="violet" variant="light">
                    {t(`sales.fulfilment.${s.fulfilment}`)}
                    {s.heldDays !== null ? ` · ${t('sales.days', { count: s.heldDays })}` : ''}
                  </Badge>
                )}
                {s.imported && (
                  <Badge size="xs" color="gray" variant="outline">
                    {t('sales.imported')}
                  </Badge>
                )}
              </Group>
            </Stack>
            <Stack gap={2} align="flex-end">
              <Text fw={700}>{money(s.total)}</Text>
              {s.status === 'COMPLETED' && (
                <Badge size="sm" variant="light" color={PAYMENT_STATE_COLORS[s.paymentState]}>
                  {s.paymentState === 'PAID'
                    ? t('sales.paymentState.PAID')
                    : t('sales.owedAmount', { amount: money(s.owed) })}
                </Badge>
              )}
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
