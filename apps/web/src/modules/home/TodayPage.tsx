import { Anchor, Badge, Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import type { ActivityItem } from '@organza/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useActivity, useToday } from '@web/modules/reports/api';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { formatDateTime, formatNumber } from '@web/shared/lib/format';
import classes from './today.module.css';

/** Today (proposal F): own sales for employees, the shop for managers, with profit for Admin. */
export function TodayPage() {
  const { t, i18n } = useTranslation();
  const { user, can } = useSession();
  const money = useMoney();
  const query = useToday();

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const before = Number(d.lastWeek.total);
  const change = before > 0 ? Math.round(((Number(d.sales.total) - before) / before) * 100) : null;
  const peak = Math.max(1, ...d.last7.map((x) => Number(x.total)));
  const openOrders = d.orders.reduce((s, o) => s + o.count, 0);
  const weekday = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${date}T00:00:00Z`),
    );

  return (
    <>
      <PageHeader title={t('home.welcome', { name: user?.name ?? '' })} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder>
          <Text size="sm" c="dimmed">
            {d.scope === 'OWN' ? t('today.mySales') : t('today.sales')}
          </Text>
          <Text fw={700} size="xl">
            {money(d.sales.total)}
          </Text>
          <Text size="xs" c="dimmed">
            {t('today.salesCount', { count: d.sales.count, pieces: d.sales.pieces })}
          </Text>
          {change !== null && (
            <Badge mt={6} variant="light" color={change >= 0 ? 'green' : 'red'}>
              {t('today.vsLastWeek', {
                change: `${change >= 0 ? '+' : ''}${formatNumber(change, i18n.language)}%`,
              })}
            </Badge>
          )}
        </Card>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            {t('today.byMethod')}
          </Text>
          <Stack gap={2} mt={4}>
            {d.byMethod.length === 0 && <Text size="sm">—</Text>}
            {d.byMethod.map((m) => (
              <Group key={m.method} justify="space-between">
                <Text size="sm">{t(`sales.method.${m.method}`)}</Text>
                <Text size="sm" fw={600}>
                  {money(m.amount)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
        {d.grossProfit !== null ? (
          <Card withBorder>
            <Text size="sm" c="dimmed">
              {t('today.grossProfit')}
            </Text>
            <Text fw={700} size="xl" c={Number(d.grossProfit) < 0 ? 'red' : undefined}>
              {money(d.grossProfit)}
            </Text>
          </Card>
        ) : (
          <Card withBorder>
            <Text size="sm" c="dimmed">
              {t('today.openOrders')}
            </Text>
            <Text fw={700} size="xl">
              {openOrders}
            </Text>
          </Card>
        )}
        {d.debtsOwed !== null && (
          <Card withBorder component={Link} to="/reports?tab=debts">
            <Text size="sm" c="dimmed">
              {t('today.debtsOwed')}
            </Text>
            <Text fw={700} size="xl" c="orange.8">
              {money(d.debtsOwed)}
            </Text>
          </Card>
        )}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <Card withBorder>
          <Text fw={600} mb="sm">
            {t('today.last7')}
          </Text>
          <div className={classes.bars}>
            {d.last7.map((x) => (
              <div key={x.date} className={classes.barColumn} title={money(x.total)}>
                <div className={classes.barTrack}>
                  <div
                    className={x.date === d.date ? classes.barToday : classes.bar}
                    style={{ height: `${Math.max(2, (Number(x.total) / peak) * 100)}%` }}
                  />
                </div>
                <Text size="xs" c="dimmed">
                  {weekday(x.date)}
                </Text>
              </div>
            ))}
          </div>
        </Card>
        <Card withBorder>
          <Text fw={600} mb="sm">
            {t('today.toDo')}
          </Text>
          <Stack gap={6}>
            {can('orders.view') && (
              <Todo to="/orders" label={t('today.openOrders')} count={openOrders}>
                <Group gap={4}>
                  {d.orders.map((o) => (
                    <Badge key={o.status} size="xs" variant="light">
                      {t(`orders.status.${o.status}`)} {o.count}
                    </Badge>
                  ))}
                </Group>
              </Todo>
            )}
            <Todo to="/sales" label={t('today.heldSales')} count={d.heldSales} />
            {can('approvals.decide') && (
              <Todo to="/approvals" label={t('today.approvals')} count={d.approvalsWaiting} alert />
            )}
            <Todo to="/shifts" label={t('today.openShifts')} count={d.openShifts} />
            <Todo to="/stock" label={t('today.lowStock')} count={d.lowStock} alert />
          </Stack>
        </Card>
      </SimpleGrid>

      <Activity />
    </>
  );
}

function Todo({
  to,
  label,
  count,
  alert,
  children,
}: {
  to: string;
  label: string;
  count: number;
  alert?: boolean;
  children?: ReactNode;
}) {
  return (
    <UnstyledButton component={Link} to={to} className={classes.todo}>
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={2}>
          <Text size="sm">{label}</Text>
          {children}
        </Stack>
        <Badge color={alert && count > 0 ? 'red' : 'gray'} variant={count > 0 ? 'filled' : 'light'}>
          {count}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}

const ENTITY_LINK: Record<string, (id: string) => string> = {
  sale: (id) => `/sales/${id}`,
  order: (id) => `/orders/${id}`,
  product: (id) => `/products/${id}`,
  customer: (id) => `/customers/${id}`,
  supplier: (id) => `/suppliers/${id}`,
  supplier_receipt: (id) => `/purchasing/receipts/${id}`,
  purchase_order: (id) => `/purchasing/orders/${id}`,
};

function Activity() {
  const { t, i18n } = useTranslation();
  const query = useActivity(30);
  if (!query.data?.length) return null;
  return (
    <Card withBorder>
      <Text fw={600} mb="sm">
        {t('today.activity')}
      </Text>
      <Stack gap={8}>
        {query.data.map((a) => (
          <ActivityLine key={a.id} item={a} language={i18n.language} />
        ))}
      </Stack>
    </Card>
  );
}

function ActivityLine({ item: a, language }: { item: ActivityItem; language: string }) {
  const { t } = useTranslation();
  const link = a.entityId ? ENTITY_LINK[a.entity]?.(a.entityId) : undefined;
  const what = t(`activity.${a.action}`, {
    defaultValue: a.action.toLowerCase().replace(/_/g, ' '),
  });
  const detail = a.summary
    ? [a.summary.number, a.summary.name, a.summary.reason].filter(Boolean).join(' · ')
    : '';
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Text size="sm" style={{ minWidth: 0 }} truncate>
        <b>{a.by ?? '—'}</b> {what}
        {detail &&
          (link ? (
            <>
              {' · '}
              <Anchor component={Link} to={link} size="sm">
                {detail}
              </Anchor>
            </>
          ) : (
            ` · ${detail}`
          ))}
      </Text>
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        {formatDateTime(a.at, language)}
      </Text>
    </Group>
  );
}
