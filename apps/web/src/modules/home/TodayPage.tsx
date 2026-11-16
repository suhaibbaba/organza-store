import { Badge, Button } from '@mantine/core';
import type { ActivityItem } from '@organza/shared';
import {
  IconCash,
  IconCashRegister,
  IconCreditCard,
  IconPackageImport,
  IconPlus,
  IconReceipt,
  IconTags,
  IconTrendingUp,
  IconTruckDelivery,
  IconUserExclamation,
} from '@tabler/icons-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useActivity, useToday } from '@web/modules/reports/api';
import { PageAction } from '@web/shared/components/PageAction';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import {
  Banner,
  Initials,
  StatCard,
  StatGrid,
  Widget,
  WidgetRow,
} from '@web/shared/components/Widgets';
import { formatDateTime, formatNumber } from '@web/shared/lib/format';
import classes from './today.module.css';

/**
 * Today (proposal F), laid out like the clinic dashboard: a greeting banner, then the key
 * numbers, the week and the activity feed in the main column, with quick actions and what is
 * waiting in a 292px side column. Own sales for employees, the shop for managers, profit for Admin.
 */
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
  const weekTotal = d.last7.reduce((s, x) => s + Number(x.total), 0);
  const openOrders = d.orders.reduce((s, o) => s + o.count, 0);
  const date = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language, { ...opts, timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );

  return (
    <div className={classes.page}>
      {can('sales.create') && (
        <PageAction>
          <Button component={Link} to="/pos" leftSection={<IconPlus size={16} />}>
            {t('today.newSale')}
          </Button>
        </PageAction>
      )}
      <Banner
        title={t('home.welcome', { name: user?.name ?? '' })}
        subtitle={date(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        end={
          d.openShifts > 0 ? (
            <Badge color="green" size="lg">
              {t('today.shiftOpen')}
            </Badge>
          ) : undefined
        }
      />

      <div className={classes.grid}>
        <div className={classes.main}>
          <StatGrid>
            <StatCard
              icon={IconReceipt}
              label={d.scope === 'OWN' ? t('today.mySales') : t('today.sales')}
              value={money(d.sales.total)}
              foot={
                <>
                  <span>
                    {t('today.salesCount', { count: d.sales.count, pieces: d.sales.pieces })}
                  </span>
                  {change !== null && (
                    <span className={change >= 0 ? classes.up : classes.down}>
                      <IconTrendingUp size={14} />
                      {`${change >= 0 ? '+' : ''}${formatNumber(change, i18n.language)}%`}
                    </span>
                  )}
                </>
              }
            />
            {d.grossProfit !== null && (
              <StatCard
                icon={IconCash}
                label={t('today.grossProfit')}
                value={money(d.grossProfit)}
                tone={Number(d.grossProfit) < 0 ? 'danger' : 'success'}
              />
            )}
            {can('orders.view') && (
              <StatCard
                icon={IconTruckDelivery}
                label={t('today.openOrders')}
                value={formatNumber(openOrders, i18n.language)}
                tone={openOrders > 0 ? 'warning' : 'neutral'}
                to="/orders"
              />
            )}
            {d.debtsOwed !== null && (
              <StatCard
                icon={IconUserExclamation}
                label={t('today.debtsOwed')}
                value={money(d.debtsOwed)}
                tone={Number(d.debtsOwed) > 0 ? 'danger' : 'neutral'}
                to="/reports?tab=debts"
              />
            )}
          </StatGrid>

          <Widget
            title={t('today.last7')}
            action={<span className={classes.weekTotal}>{money(weekTotal.toFixed(2))}</span>}
          >
            <div className={classes.bars}>
              {d.last7.map((x) => (
                <div key={x.date} className={classes.barColumn} title={money(x.total)}>
                  <div className={classes.barTrack}>
                    <div
                      className={x.date === d.date ? classes.barToday : classes.bar}
                      style={
                        {
                          '--bar': `${Math.max(3, (Number(x.total) / peak) * 100)}%`,
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span className={classes.barLabel}>{date(x.date, { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          </Widget>

          <Activity />
        </div>

        <aside className={classes.side}>
          <Widget title={t('today.quickActions')}>
            <div className={classes.quick}>
              {can('sales.create') && (
                <Button
                  component={Link}
                  to="/pos"
                  fullWidth
                  justify="flex-start"
                  leftSection={<IconCashRegister size={18} />}
                >
                  {t('today.newSale')}
                </Button>
              )}
              {can('orders.create') && (
                <Button
                  component={Link}
                  to="/orders/new"
                  variant="default"
                  fullWidth
                  justify="flex-start"
                  leftSection={<IconTruckDelivery size={18} />}
                >
                  {t('today.newOrder')}
                </Button>
              )}
              {can('purchasing.receive') && (
                <Button
                  component={Link}
                  to="/purchasing/receive"
                  variant="default"
                  fullWidth
                  justify="flex-start"
                  leftSection={<IconPackageImport size={18} />}
                >
                  {t('today.receiveGoods')}
                </Button>
              )}
              {can('labels.print') && (
                <Button
                  component={Link}
                  to="/labels"
                  variant="default"
                  fullWidth
                  justify="flex-start"
                  leftSection={<IconTags size={18} />}
                >
                  {t('today.printLabels')}
                </Button>
              )}
            </div>
          </Widget>

          <Widget title={t('today.toDo')}>
            {can('orders.view') && (
              <WidgetRow
                to="/orders"
                label={t('today.openOrders')}
                detail={d.orders
                  .map((o) => `${t(`orders.status.${o.status}`)} ${o.count}`)
                  .join(' · ')}
                end={<Count n={openOrders} />}
              />
            )}
            <WidgetRow to="/sales" label={t('today.heldSales')} end={<Count n={d.heldSales} />} />
            {can('approvals.decide') && (
              <WidgetRow
                to="/approvals"
                label={t('today.approvals')}
                end={<Count n={d.approvalsWaiting} alert />}
              />
            )}
            <WidgetRow
              to="/shifts"
              label={t('today.openShifts')}
              end={<Count n={d.openShifts} />}
            />
            <WidgetRow
              to="/stock"
              label={t('today.lowStock')}
              end={<Count n={d.lowStock} alert />}
            />
          </Widget>

          {d.byMethod.length > 0 && (
            <Widget title={t('today.byMethod')}>
              {d.byMethod.map((m) => (
                <WidgetRow
                  key={m.method}
                  start={<IconCreditCard size={18} className={classes.methodIcon} />}
                  label={t(`sales.method.${m.method}`)}
                  end={<span className={classes.amount}>{money(m.amount)}</span>}
                />
              ))}
            </Widget>
          )}
        </aside>
      </div>
    </div>
  );
}

function Count({ n, alert }: { n: number; alert?: boolean }) {
  return (
    <Badge color={n === 0 ? 'gray' : alert ? 'red' : 'blue'} variant="light">
      {n}
    </Badge>
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
  const query = useActivity(12);
  if (!query.data?.length) return null;
  return (
    <Widget title={t('today.activity')}>
      {query.data.map((a) => (
        <ActivityLine key={a.id} item={a} language={i18n.language} />
      ))}
    </Widget>
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
    <WidgetRow
      to={link}
      start={<Initials name={a.by ?? '—'} size="sm" />}
      label={`${a.by ?? '—'} · ${what}`}
      detail={detail || undefined}
      end={<span className={classes.time}>{formatDateTime(a.at, language)}</span>}
    />
  );
}
