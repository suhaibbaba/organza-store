import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  type OrderStatus,
  type OrderSummary,
  SALE_SOURCES,
  type SaleSource,
} from '@organza/shared';
import { IconAlertTriangle, IconListCheck, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useOrders } from './api';
import classes from './orders.module.css';

const COLUMNS: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT'];

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'blue',
  CONFIRMED: 'grape',
  PREPARING: 'orange',
  READY: 'teal',
  OUT: 'indigo',
  COLLECTED: 'green',
  CANCELLED: 'gray',
  RETURNED: 'red',
};

export const SOURCE_COLORS: Record<SaleSource, string> = {
  COUNTER: 'gray',
  WHATSAPP: 'green',
  ONLINE: 'blue',
  PHONE: 'orange',
};

/** How much of the order is paid so far: deposit, then (once out) the courier's settlement. */
export function paymentBadge(o: OrderSummary): { color: string; key: string } {
  const paid = Number(o.deposit) + (o.status === 'OUT' ? Number(o.settled) : 0);
  const done = ['COLLECTED'].includes(o.status) || paid >= Number(o.total);
  if (done) return { color: 'green', key: 'PAID' };
  if (paid > 0) return { color: 'orange', key: 'PARTLY_PAID' };
  return { color: 'red', key: 'UNPAID' };
}

/** Orders board (proposal F "Orders screen"): columns on desktop, one tab at a time on phones. */
export function OrdersPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 250);
  const [source, setSource] = useState<SaleSource | null>(null);
  const [tab, setTab] = useState<OrderStatus>('NEW');
  const [picked, setPicked] = useState<string[]>([]);
  const filters = { q: debounced || undefined, source: source ?? undefined, pageSize: 200 };
  const open = useOrders({ ...filters, open: true }, true);
  const out = useOrders({ ...filters, status: 'OUT', unsettled: true }, true);

  if (open.isPending || out.isPending) return <FullScreenLoader />;
  if (open.isError) return <ErrorState error={open.error} onRetry={() => void open.refetch()} />;
  const all = [...(open.data?.items ?? []), ...(out.data?.items ?? [])];
  const byStatus = (s: OrderStatus) => all.filter((o) => o.status === s);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className={classes.board}>
      <PageHeader
        title={t('nav.orders')}
        actions={
          picked.length > 0 && (
            <Button
              variant="light"
              leftSection={<IconListCheck size={16} />}
              onClick={() => navigate(`/orders/pick?ids=${picked.join(',')}`)}
            >
              {t('orders.pickList')} ({picked.length})
            </Button>
          )
        }
        primary={
          can('orders.create') && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/orders/new')}>
              {t('orders.new')}
            </Button>
          )
        }
      />
      <div className={classes.filters}>
        <TextInput
          className={classes.search}
          leftSection={<IconSearch size={16} />}
          placeholder={t('orders.searchHint')}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <Select
          className={classes.sourceFilter}
          clearable
          placeholder={t('orders.allSources')}
          value={source}
          onChange={(v) => setSource(v as SaleSource | null)}
          data={SALE_SOURCES.map((s) => ({ value: s, label: t(`orders.source.${s}`) }))}
        />
      </div>
      <div className={classes.tabs}>
        <SegmentedControl
          fullWidth
          size="xs"
          value={tab}
          onChange={(v) => setTab(v as OrderStatus)}
          data={COLUMNS.map((s) => ({
            value: s,
            label: `${t(`orders.status.${s}`)} ${byStatus(s).length}`,
          }))}
        />
      </div>
      <div className={classes.columns}>
        {COLUMNS.map((s) => (
          <section key={s} className={`${classes.column} ${tab === s ? classes.columnActive : ''}`}>
            <div className={classes.columnHead}>
              <h2 className="ds-heading">{t(`orders.status.${s}`)}</h2>
              <Badge variant="light" radius="xl" color={ORDER_STATUS_COLORS[s]}>
                {byStatus(s).length}
              </Badge>
            </div>
            <div className={`${classes.columnBody} organza-scroll`}>
              {byStatus(s).length === 0 && (
                <Text size="sm" className={`${classes.columnEmpty} ds-muted ds-center`}>
                  {t('orders.emptyColumn')}
                </Text>
              )}
              {byStatus(s).map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  picked={picked.includes(o.id)}
                  onPick={
                    ['CONFIRMED', 'PREPARING', 'READY'].includes(o.status) ? toggle : undefined
                  }
                  onOpen={() => navigate(`/orders/${o.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order: o,
  picked,
  onPick,
  onOpen,
}: {
  order: OrderSummary;
  picked: boolean;
  onPick?: (id: string) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const pay = paymentBadge(o);
  const hours = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 3_600_000);
  const age =
    hours < 1
      ? t('orders.age.now')
      : hours < 24
        ? t('orders.age.hours', { count: hours })
        : t('orders.age.days', { count: Math.floor(hours / 24) });
  return (
    <Card
      withBorder
      padding="sm"
      radius="lg"
      className={`${classes.card} ${o.short > 0 ? classes.cardShort : ''}`}
      onClick={onOpen}
    >
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Group gap={6} wrap="nowrap" className="ds-min-0">
          {onPick && (
            <Checkbox
              size="xs"
              checked={picked}
              aria-label={t('orders.pickList')}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onPick(o.id)}
            />
          )}
          <Text size="sm" dir="ltr" className="ds-bold ds-ink">
            {o.number.replace(/^ORD-\d{4}-/, '#')}
          </Text>
          <Badge size="xs" variant="light" color={SOURCE_COLORS[o.source]}>
            {t(`orders.source.${o.source}`)}
          </Badge>
        </Group>
        <Text size="xs" className="ds-muted ds-nowrap">
          {age}
        </Text>
      </Group>
      <Text size="sm" truncate className="ds-mt-xs">
        {o.customer.name}
        {o.customer.city ? ` · ${o.customer.city}` : ''}
      </Text>
      {o.images.length > 0 && (
        <div className={`${classes.strip} ds-mt-xs`}>
          {o.images.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" />
          ))}
        </div>
      )}
      <Group justify="space-between" wrap="nowrap" className="ds-mt-xs">
        <Text size="sm" className="ds-bold ds-num">
          {money(o.total)}
        </Text>
        <Group gap={4} wrap="nowrap">
          {o.short > 0 && (
            <Badge size="xs" color="red" leftSection={<IconAlertTriangle size={10} />}>
              {t('orders.shortCount', { count: o.short })}
            </Badge>
          )}
          {o.status === 'OUT' && o.courier ? (
            <Badge size="xs" variant="outline" color="indigo">
              {o.courier.name}
            </Badge>
          ) : (
            <Badge size="xs" variant="light" color={pay.color}>
              {t(`sales.paymentState.${pay.key}`)}
            </Badge>
          )}
        </Group>
      </Group>
    </Card>
  );
}
