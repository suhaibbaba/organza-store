import { Badge, Button, Card, Checkbox, Group, Stack, Table, Text } from '@mantine/core';
import { addMoney, fromMinor, localize, toMinor } from '@organza/shared';
import { IconPhoto, IconPrinter } from '@tabler/icons-react';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { api } from '@web/shared/lib/api-client';
import type { OrderView } from '@organza/shared';
import { usePickList } from './api';
import classes from './orders.module.css';

/**
 * Pick list for one or several orders, by shelf location, ticked on screen as pieces are
 * picked; below it a packing slip per order. Prints from the browser.
 */
export function PickListPage() {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const [params] = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const pick = usePickList(ids);
  const orders = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['order', id],
      queryFn: () => api.get<OrderView>(`/orders/${id}`),
    })),
  });
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  if (pick.isPending || orders.some((o) => o.isPending)) return <FullScreenLoader />;
  if (pick.isError) return <ErrorState error={pick.error} onRetry={() => void pick.refetch()} />;
  const lines = pick.data ?? [];
  const done = lines.filter((l) => ticked[l.id]).length;

  return (
    <Stack gap="md">
      <div className={classes.noPrint}>
        <PageHeader
          title={t('orders.pickList')}
          back={{ to: '/orders', label: t('nav.orders') }}
          actions={
            <>
              <Badge size="lg" variant="light" color={done === lines.length ? 'teal' : 'gray'}>
                {t('orders.picked', { done, total: lines.length })}
              </Badge>
              <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
                {t('labels.print')}
              </Button>
            </>
          }
        />
      </div>
      <Card padding={0}>
        <Table verticalSpacing={8}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={classes.colCheck} />
              <Table.Th className="ds-col-thumb" />
              <Table.Th>{t('catalogue.name')}</Table.Th>
              <Table.Th>{t('catalogue.location')}</Table.Th>
              <Table.Th>{t('sales.quantity')}</Table.Th>
              <Table.Th>{t('orders.order')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => (
              <Table.Tr key={l.id} className={ticked[l.id] ? classes.picked : undefined}>
                <Table.Td>
                  <Checkbox
                    aria-label={t('orders.pickedOne')}
                    checked={Boolean(ticked[l.id])}
                    onChange={(e) => setTicked({ ...ticked, [l.id]: e.currentTarget.checked })}
                  />
                </Table.Td>
                <Table.Td>
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt="" width={40} height={56} className={classes.thumb} />
                  ) : (
                    <div className={classes.thumb}>
                      <IconPhoto size={14} />
                    </div>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" className="ds-bold">
                    {localize(l.name, i18n.language)}
                  </Text>
                  <Text size="xs" className="ds-muted">
                    {[l.variantLabel ? localize(l.variantLabel, i18n.language) : null, l.sku]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Table.Td>
                <Table.Td>{l.location ?? '—'}</Table.Td>
                <Table.Td>
                  <Text className="ds-bold ds-num">{l.quantity}</Text>
                </Table.Td>
                <Table.Td>
                  <span className="ds-ltr ds-num">{l.orderNumber}</span>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      {orders.map((q) =>
        q.data ? (
          <Card key={q.data.id} className={classes.slip}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text dir="ltr" className="ds-heading">
                  {q.data.number}
                </Text>
                <Text size="sm">{q.data.customer.name}</Text>
                {q.data.customer.phone && (
                  <Text size="sm" dir="ltr">
                    {q.data.customer.phone}
                  </Text>
                )}
                <Text size="sm">{[q.data.city, q.data.address].filter(Boolean).join(' · ')}</Text>
              </Stack>
              <Stack gap={2} align="flex-end">
                <Text size="sm">{t(`orders.delivery.${q.data.delivery}`)}</Text>
                {q.data.courier && <Text size="sm">{q.data.courier.name}</Text>}
                <Text className="ds-bold">
                  {t('orders.toCollect', {
                    amount: money(
                      Number(q.data.cod) > 0
                        ? q.data.cod
                        : addMoney(q.data.total, fromMinor(-toMinor(q.data.deposit))),
                    ),
                  })}
                </Text>
              </Stack>
            </Group>
            <Table className="ds-mt-sm ds-text-sm">
              <Table.Tbody>
                {q.data.lines.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      {localize(l.name, i18n.language)}
                      {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
                    </Table.Td>
                    <Table.Td>× {l.quantity}</Table.Td>
                    <Table.Td className="ds-end ds-num">{money(l.lineTotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {q.data.note && (
              <Text size="sm" className="ds-mt-sm ds-pre-line">
                {q.data.note}
              </Text>
            )}
          </Card>
        ) : null,
      )}
    </Stack>
  );
}
