import {
  Badge,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
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
import { Initials } from '@web/shared/components/Widgets';
import c from './pages.module.css';

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
      <PageHeader title={t('nav.sales')} count={query.data ? query.data.total : undefined} />
      <div className={c.filters}>
        <TextInput
          className={c.search}
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
        <div className={c.pager}>
          <Pagination value={page} onChange={setPage} total={pages} />
        </div>
      )}
    </>
  );
}

export function SaleList({ sales }: { sales: SaleSummary[] }) {
  if (sales.length === 0) return null;
  return (
    <>
      <div className={c.wideOnly}>
        <SaleTable sales={sales} />
      </div>
      <div className={c.phoneOnly}>
        <SaleCards sales={sales} />
      </div>
    </>
  );
}

/** What is still owed, or that it is paid; only completed sales have a payment state. */
function PaymentBadge({ sale: s }: { sale: SaleSummary }) {
  const { t } = useTranslation();
  const money = useMoney();
  if (s.status !== 'COMPLETED') return null;
  return (
    <Badge size="sm" variant="light" color={PAYMENT_STATE_COLORS[s.paymentState]}>
      {s.paymentState === 'PAID'
        ? t('sales.paymentState.PAID')
        : t('sales.owedAmount', { amount: money(s.owed) })}
    </Badge>
  );
}

function StateBadges({ sale: s }: { sale: SaleSummary }) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}

function SaleTable({ sales }: { sales: SaleSummary[] }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const navigate = useNavigate();
  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={640}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="ds-col-sm">{t('catalogue.number')}</Table.Th>
              <Table.Th className="ds-col-md">{t('common.date')}</Table.Th>
              <Table.Th>{t('pos.customer')}</Table.Th>
              <Table.Th className="ds-col-xs">{t('orders.lines')}</Table.Th>
              <Table.Th className="ds-col-sm ds-end">{t('sales.total')}</Table.Th>
              <Table.Th className="ds-col-md">{t('catalogue.statusLabel')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sales.map((s) => (
              <Table.Tr
                key={s.id}
                className="ds-clickable"
                onClick={() => navigate(`/sales/${s.id}`)}
              >
                <Table.Td className="ds-medium ds-nowrap">
                  <span className="o-num">{s.number}</span>
                </Table.Td>
                <Table.Td className="ds-muted ds-nowrap">
                  {formatDateTime(s.createdAt, i18n.language)}
                </Table.Td>
                <Table.Td>
                  {s.customer ? (
                    <span className={c.person}>
                      <Initials name={s.customer.name} size="sm" />
                      <span className="ds-truncate">{s.customer.name}</span>
                    </span>
                  ) : (
                    <span className="ds-faint">—</span>
                  )}
                </Table.Td>
                <Table.Td className="ds-num">{s.itemCount}</Table.Td>
                <Table.Td className="ds-end ds-bold ds-nowrap">{money(s.total)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <PaymentBadge sale={s} />
                    <StateBadges sale={s} />
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function SaleCards({ sales }: { sales: SaleSummary[] }) {
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
          className="ds-clickable"
          onClick={() => navigate(`/sales/${s.id}`)}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2} className="ds-min-0">
              <Group gap={6}>
                <Text className="ds-bold o-num">{s.number}</Text>
                {s.customer && <Text truncate>{s.customer.name}</Text>}
              </Group>
              <Text size="xs" className="ds-muted">
                {formatDateTime(s.createdAt, i18n.language)} ·{' '}
                {t('pos.items', { count: s.itemCount })}
              </Text>
              <Group gap={4}>
                <StateBadges sale={s} />
              </Group>
            </Stack>
            <Stack gap={2} align="flex-end">
              <Text className="ds-bold ds-nowrap">{money(s.total)}</Text>
              <PaymentBadge sale={s} />
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
