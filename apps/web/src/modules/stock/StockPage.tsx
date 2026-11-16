import {
  Badge,
  Card,
  Checkbox,
  Drawer,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { localize } from '@organza/shared';
import { IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { formatDateTime } from '@web/shared/lib/format';
import { type StockFilters, useItemHistory, useStock } from './api';
import { AskCorrectionDialog } from './AskCorrectionDialog';
import classes from './stock.module.css';

const PAGE_SIZE = 50;

export function StockPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const phone = useMediaQuery('(max-width: 48em)');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 300);
  const [filters, setFilters] = useState<StockFilters>({ page: 1 });
  const query = useStock({ ...filters, q: debounced, pageSize: PAGE_SIZE });
  const historyItem = params.get('item');
  const [correcting, setCorrecting] = useState<{
    itemId: string;
    name: string;
    onHand: number;
  } | null>(null);
  const openRow = (r: { itemId: string; onHand: number } & Parameters<typeof name>[0]) => {
    if (can('stock.history')) setParams({ item: r.itemId });
    else if (can('approvals.request'))
      setCorrecting({ itemId: r.itemId, name: name(r), onHand: r.onHand });
  };
  const name = (r: { name: Record<string, string | undefined>; options: string[] }) =>
    [localize(r.name, i18n.language), ...r.options].join(' · ');

  return (
    <>
      <PageHeader title={t('stock.title')} />
      <Group gap="md" wrap="wrap" className="ds-mb-md">
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={t('catalogue.searchHint')}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className={classes.search}
          type="search"
        />
        <Checkbox
          size="xs"
          label={t('catalogue.lowStock')}
          checked={Boolean(filters.lowStock)}
          onChange={(e) => setFilters({ ...filters, page: 1, lowStock: e.currentTarget.checked })}
        />
        <Checkbox
          size="xs"
          label={t('stock.withDamaged')}
          checked={Boolean(filters.damaged)}
          onChange={(e) => setFilters({ ...filters, page: 1, damaged: e.currentTarget.checked })}
        />
      </Group>
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.items.length === 0 && <EmptyState />}
      {query.data && query.data.items.length > 0 && phone && (
        <Stack gap="xs" className="o-list">
          {query.data.items.map((r) => (
            <Card
              key={r.itemId}
              withBorder
              padding="xs"
              onClick={() => openRow(r)}
              className="ds-clickable"
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={0} className="ds-min-0">
                  <Text size="sm" className="ds-bold" truncate>
                    {name(r)}
                  </Text>
                  <Text size="xs" className="ds-muted ds-ltr">
                    {r.sku}
                  </Text>
                </Stack>
                <Badge
                  color={r.available <= 0 ? 'red' : r.lowStock ? 'orange' : 'gray'}
                  variant="light"
                >
                  {r.available}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {query.data && query.data.items.length > 0 && !phone && (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('catalogue.name')}</Table.Th>
                  <Table.Th>{t('catalogue.sku')}</Table.Th>
                  <Table.Th>{t('stock.onHand')}</Table.Th>
                  <Table.Th>{t('stock.reserved')}</Table.Th>
                  <Table.Th>{t('stock.available')}</Table.Th>
                  <Table.Th>{t('stock.damaged')}</Table.Th>
                  <Table.Th>{t('catalogue.location')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {query.data.items.map((r) => (
                  <Table.Tr key={r.itemId} onClick={() => openRow(r)} className="ds-clickable">
                    <Table.Td className="ds-medium">{name(r)}</Table.Td>
                    <Table.Td className="ds-ltr">{r.sku}</Table.Td>
                    <Table.Td>{r.onHand}</Table.Td>
                    <Table.Td>{r.reserved || ''}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={r.available <= 0 ? 'red' : r.lowStock ? 'orange' : 'gray'}
                        variant="light"
                      >
                        {r.available}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{r.damaged || ''}</Table.Td>
                    <Table.Td>{r.location ?? ''}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {(query.data?.total ?? 0) > PAGE_SIZE && (
        <Group justify="center" className="ds-mt-md">
          <Pagination
            size="sm"
            total={Math.ceil((query.data?.total ?? 0) / PAGE_SIZE)}
            value={filters.page ?? 1}
            onChange={(page) => setFilters({ ...filters, page })}
          />
        </Group>
      )}
      <HistoryDrawer itemId={historyItem} onClose={() => setParams({})} language={i18n.language} />
      <AskCorrectionDialog
        key={correcting?.itemId ?? 'none'}
        item={correcting}
        onClose={() => setCorrecting(null)}
      />
    </>
  );
}

function HistoryDrawer({
  itemId,
  onClose,
  language,
}: {
  itemId: string | null;
  onClose: () => void;
  language: string;
}) {
  const { t } = useTranslation();
  const history = useItemHistory(itemId);
  return (
    <Drawer
      opened={Boolean(itemId)}
      onClose={onClose}
      title={t('stock.history')}
      position="right"
      size="md"
    >
      {history.isPending && <FullScreenLoader />}
      {history.data?.length === 0 && <EmptyState />}
      <Stack gap={6}>
        {history.data?.map((m) => (
          <Group
            key={m.id}
            justify="space-between"
            wrap="nowrap"
            className={m.reversed ? 'ds-dimmed' : undefined}
          >
            <Stack gap={0}>
              <Text size="sm">
                {t(`stock.reason.${m.reason}`)}
                {m.bucket === 'DAMAGED' && ` · ${t('stock.damaged')}`}
              </Text>
              <Text size="xs" className="ds-muted">
                {formatDateTime(m.occurredAt, language)}
                {m.note && ` · ${m.note}`}
              </Text>
            </Stack>
            <Text className={`ds-bold ${m.quantity > 0 ? 'ds-success' : 'ds-danger'}`} dir="ltr">
              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
            </Text>
          </Group>
        ))}
      </Stack>
    </Drawer>
  );
}
