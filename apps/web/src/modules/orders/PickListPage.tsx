import { Button, Card, Center, Checkbox, Group, Stack, Table, Text, Title } from '@mantine/core';
import { addMoney, fromMinor, localize, toMinor } from '@organza/shared';
import { IconPhoto, IconPrinter } from '@tabler/icons-react';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useMoney } from '@web/modules/catalogue/components';
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
      <Group justify="space-between" className={classes.noPrint}>
        <Title order={2} size="h3">
          {t('orders.pickList')}
        </Title>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {t('orders.picked', { done, total: lines.length })}
          </Text>
          <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
            {t('labels.print')}
          </Button>
        </Group>
      </Group>
      <Card withBorder>
        <Table verticalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={32} />
              <Table.Th w={56} />
              <Table.Th>{t('catalogue.name')}</Table.Th>
              <Table.Th>{t('catalogue.location')}</Table.Th>
              <Table.Th>{t('sales.quantity')}</Table.Th>
              <Table.Th>{t('orders.order')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => (
              <Table.Tr key={l.id} style={{ opacity: ticked[l.id] ? 0.5 : 1 }}>
                <Table.Td>
                  <Checkbox
                    aria-label={t('orders.pickedOne')}
                    checked={Boolean(ticked[l.id])}
                    onChange={(e) => setTicked({ ...ticked, [l.id]: e.currentTarget.checked })}
                  />
                </Table.Td>
                <Table.Td>
                  {l.imageUrl ? (
                    <img
                      src={l.imageUrl}
                      alt=""
                      width={40}
                      height={56}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  ) : (
                    <Center w={40} h={56} bg="gray.1">
                      <IconPhoto size={14} />
                    </Center>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {localize(l.name, i18n.language)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {[l.variantLabel ? localize(l.variantLabel, i18n.language) : null, l.sku]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Table.Td>
                <Table.Td>{l.location ?? '—'}</Table.Td>
                <Table.Td>
                  <Text fw={700}>{l.quantity}</Text>
                </Table.Td>
                <Table.Td dir="ltr" style={{ textAlign: 'start' }}>
                  {l.orderNumber}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      {orders.map((q) =>
        q.data ? (
          <Card key={q.data.id} withBorder className={classes.slip}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={700} dir="ltr">
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
                <Text fw={700}>
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
            <Table mt="xs" fz="sm">
              <Table.Tbody>
                {q.data.lines.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      {localize(l.name, i18n.language)}
                      {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
                    </Table.Td>
                    <Table.Td>× {l.quantity}</Table.Td>
                    <Table.Td style={{ textAlign: 'end' }}>{money(l.lineTotal)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {q.data.note && (
              <Text size="sm" mt="xs">
                {q.data.note}
              </Text>
            )}
          </Card>
        ) : null,
      )}
    </Stack>
  );
}
