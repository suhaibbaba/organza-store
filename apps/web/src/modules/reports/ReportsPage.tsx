import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import {
  type AgingBuckets,
  localize,
  type ReportRange,
  SALES_GROUPS,
  type SalesGroup,
} from '@organza/shared';
import { IconDownload } from '@tabler/icons-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { downloadCsv } from '@web/shared/lib/csv';
import { formatDate } from '@web/shared/lib/format';
import {
  useCashReport,
  useDaily,
  useDebts,
  useInventory,
  usePaymentMethods,
  useProfitAndLoss,
  useSalesReport,
  useSupplierDebts,
} from './api';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Preset = 'today' | 'week' | 'month' | 'lastMonth';
function presetRange(p: Preset): ReportRange {
  const now = new Date();
  const today = iso(now);
  if (p === 'today') return { from: today, to: today };
  if (p === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: iso(start), to: today };
  }
  if (p === 'month')
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

const TABS = [
  'summary',
  'sales',
  'cash',
  'methods',
  'debts',
  'suppliers',
  'inventory',
  'daily',
] as const;
type Tab = (typeof TABS)[number];
const RANGED: Tab[] = ['summary', 'sales', 'cash', 'methods'];

/** Reports (phase 6): every money figure comes from the ledger; each table exports to CSV. */
export function ReportsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'summary';
  const [range, setRange] = useState<ReportRange>(() => presetRange('month'));
  const [day, setDay] = useState(() => iso(new Date()));
  const valid = range.from <= range.to;
  const tabs = TABS.filter((x) => x !== 'inventory' || can('reports.cost'));

  return (
    <>
      <PageHeader title={t('nav.reports')} />
      <Tabs
        value={tab}
        onChange={(v) => setParams(v ? { tab: v } : {}, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List mb="sm" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {tabs.map((x) => (
            <Tabs.Tab key={x} value={x}>
              {t(`reports.tab.${x}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {RANGED.includes(tab) && (
          <Group mb="md" gap="xs" wrap="wrap" align="flex-end">
            <TextInput
              type="date"
              label={t('reports.from')}
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.currentTarget.value })}
            />
            <TextInput
              type="date"
              label={t('reports.to')}
              value={range.to}
              error={!valid}
              onChange={(e) => setRange({ ...range, to: e.currentTarget.value })}
            />
            <SegmentedControl
              size="xs"
              value=""
              onChange={(v) => setRange(presetRange(v as Preset))}
              data={(['today', 'week', 'month', 'lastMonth'] as const).map((p) => ({
                value: p,
                label: t(`reports.preset.${p}`),
              }))}
            />
          </Group>
        )}
        {tab === 'daily' && (
          <TextInput
            type="date"
            mb="md"
            maw={200}
            label={t('common.date')}
            value={day}
            onChange={(e) => setDay(e.currentTarget.value)}
          />
        )}
        {valid && (
          <>
            <Tabs.Panel value="summary">
              <Summary range={range} />
            </Tabs.Panel>
            <Tabs.Panel value="sales">
              <SalesBreakdown range={range} />
            </Tabs.Panel>
            <Tabs.Panel value="cash">
              <Cash range={range} />
            </Tabs.Panel>
            <Tabs.Panel value="methods">
              <Methods range={range} />
            </Tabs.Panel>
          </>
        )}
        <Tabs.Panel value="debts">
          <Debts />
        </Tabs.Panel>
        <Tabs.Panel value="suppliers">
          <SupplierDebts />
        </Tabs.Panel>
        <Tabs.Panel value="inventory">
          <Inventory />
        </Tabs.Panel>
        <Tabs.Panel value="daily">
          <Daily date={day} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function Export({ name, rows }: { name: string; rows: () => unknown[][] }) {
  const { t } = useTranslation();
  return (
    <Button
      size="xs"
      variant="default"
      leftSection={<IconDownload size={14} />}
      onClick={() => downloadCsv(name, rows())}
    >
      {t('reports.export')}
    </Button>
  );
}

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <Group justify="space-between" py={2}>
      <Text size="sm" c={muted ? 'dimmed' : undefined} fw={strong ? 700 : undefined}>
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 500}>
        {value}
      </Text>
    </Group>
  );
}

function Loading({
  query,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
}) {
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return null;
}

// ------------------------------------------------------------------ summary

function Summary({ range }: { range: ReportRange }) {
  const { t } = useTranslation();
  const money = useMoney();
  const query = useProfitAndLoss(range);
  if (!query.data) return <Loading query={query} />;
  const p = query.data;
  const rows = (): unknown[][] => [
    [t('reports.line'), t('sales.amount')],
    [t('reports.revenue'), p.revenue],
    [t('reports.discounts'), p.discounts],
    [t('reports.netSales'), p.netSales],
    ...(p.cogs !== null
      ? [
          [t('reports.cogs'), p.cogs],
          [t('reports.grossProfit'), p.grossProfit],
        ]
      : []),
    ...p.expenses.map((e) => [
      `${t('reports.expenses')}: ${t(`shifts.expense.${e.category}`, { defaultValue: e.category })}`,
      e.amount,
    ]),
    [t('reports.netProfit'), p.netProfit ?? ''],
  ];
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Text fw={600}>{t('reports.profitAndLoss')}</Text>
          <Export name={`profit-and-loss-${p.from}-${p.to}`} rows={rows} />
        </Group>
        <Line label={t('reports.revenue')} value={money(p.revenue)} />
        <Line label={t('reports.discounts')} value={`−${money(p.discounts)}`} muted />
        <Line label={t('reports.netSales')} value={money(p.netSales)} strong />
        {p.cogs !== null && <Line label={t('reports.cogs')} value={`−${money(p.cogs)}`} muted />}
        {p.grossProfit !== null && (
          <Line label={t('reports.grossProfit')} value={money(p.grossProfit)} strong />
        )}
        {p.expenses.map((e) => (
          <Line
            key={e.category}
            label={t(`shifts.expense.${e.category}`, { defaultValue: e.category })}
            value={`−${money(e.amount)}`}
            muted
          />
        ))}
        <Line label={t('reports.expenses')} value={`−${money(p.expensesTotal)}`} />
        {p.damageAndLoss !== null && Number(p.damageAndLoss) !== 0 && (
          <Line label={t('reports.damage')} value={`−${money(p.damageAndLoss)}`} muted />
        )}
        {p.promotions !== null && Number(p.promotions) !== 0 && (
          <Line label={t('reports.promotions')} value={`−${money(p.promotions)}`} muted />
        )}
        {Number(p.cashOverShort) !== 0 && (
          <Line label={t('reports.overShort')} value={money(p.cashOverShort)} muted />
        )}
        {Number(p.exchangeDifferences) !== 0 && (
          <Line label={t('reports.exchange')} value={money(p.exchangeDifferences)} muted />
        )}
        {Number(p.otherIncome) !== 0 && (
          <Line label={t('reports.otherIncome')} value={money(p.otherIncome)} muted />
        )}
        {p.netProfit !== null && (
          <Line label={t('reports.netProfit')} value={money(p.netProfit)} strong />
        )}
      </Card>
      <Stack>
        <SimpleGrid cols={3}>
          <Stat label={t('reports.salesCount')} value={String(p.sales.count)} />
          <Stat label={t('reports.pieces')} value={String(p.sales.pieces)} />
          <Stat label={t('reports.average')} value={money(p.sales.average)} />
        </SimpleGrid>
        {p.imported.count > 0 && (
          <Alert color="gray">
            {t('reports.importedHint', { count: p.imported.count, total: money(p.imported.total) })}
          </Alert>
        )}
        {p.cogs === null && (
          <Text size="xs" c="dimmed">
            {t('reports.costHidden')}
          </Text>
        )}
      </Stack>
    </SimpleGrid>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Card>
  );
}

// ------------------------------------------------------------------ sales breakdown

function SalesBreakdown({ range }: { range: ReportRange }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const [groupBy, setGroupBy] = useState<SalesGroup>('day');
  const query = useSalesReport(range, groupBy);
  const label = (l: string | { ar?: string; en?: string; he?: string }) =>
    typeof l === 'string'
      ? groupBy === 'source'
        ? t(`orders.source.${l}`)
        : groupBy === 'day'
          ? formatDate(l, i18n.language)
          : l
      : localize(l, i18n.language) || '—';
  const rows = query.data ?? [];
  const cost = rows.some((r) => r.cost !== null);
  return (
    <Stack>
      <Group justify="space-between">
        <Select
          w={200}
          allowDeselect={false}
          value={groupBy}
          onChange={(v) => setGroupBy((v as SalesGroup) ?? 'day')}
          data={SALES_GROUPS.map((g) => ({ value: g, label: t(`reports.groupBy.${g}`) }))}
        />
        <Export
          name={`sales-${groupBy}-${range.from}-${range.to}`}
          rows={() => [
            [
              t(`reports.groupBy.${groupBy}`),
              t('reports.salesCount'),
              t('reports.pieces'),
              t('reports.revenue'),
              ...(cost ? [t('reports.cogs'), t('reports.grossProfit')] : []),
            ],
            ...rows.map((r) => [
              label(r.label),
              r.sales,
              r.pieces,
              r.revenue,
              ...(cost ? [r.cost, r.profit] : []),
            ]),
          ]}
        />
      </Group>
      {!query.data ? (
        <Loading query={query} />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Card withBorder p={0}>
          <Table.ScrollContainer minWidth={520}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t(`reports.groupBy.${groupBy}`)}</Table.Th>
                  <Table.Th ta="end">{t('reports.salesCount')}</Table.Th>
                  <Table.Th ta="end">{t('reports.pieces')}</Table.Th>
                  <Table.Th ta="end">{t('reports.revenue')}</Table.Th>
                  {cost && <Table.Th ta="end">{t('reports.grossProfit')}</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.key}>
                    <Table.Td>
                      {groupBy === 'product' && r.key !== '-' ? (
                        <Anchor component={Link} to={`/products/${r.key}`} size="sm">
                          {label(r.label)}
                        </Anchor>
                      ) : (
                        label(r.label)
                      )}
                    </Table.Td>
                    <Table.Td ta="end">{r.sales}</Table.Td>
                    <Table.Td ta="end">{r.pieces}</Table.Td>
                    <Table.Td ta="end">{money(r.revenue)}</Table.Td>
                    {cost && <Table.Td ta="end">{money(r.profit ?? '0')}</Table.Td>}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

// ------------------------------------------------------------------ cash and methods

function Cash({ range }: { range: ReportRange }) {
  const { t } = useTranslation();
  const money = useMoney();
  const query = useCashReport(range);
  if (!query.data) return <Loading query={query} />;
  const c = query.data;
  return (
    <Stack>
      <Group justify="flex-end">
        <Export
          name={`cash-${c.from}-${c.to}`}
          rows={() => [
            [
              t('reports.account'),
              t('reports.opening'),
              t('reports.in'),
              t('reports.out'),
              t('reports.closing'),
            ],
            ...c.accounts.map((a) => [
              t(`reports.accountName.${a.account}`),
              a.opening,
              a.in,
              a.out,
              a.closing,
            ]),
          ]}
        />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {c.accounts.map((a) => (
          <Card key={a.account} withBorder>
            <Text fw={600} mb={4}>
              {t(`reports.accountName.${a.account}`)}
            </Text>
            <Line label={t('reports.opening')} value={money(a.opening)} muted />
            <Line label={t('reports.in')} value={`+${money(a.in)}`} />
            <Line label={t('reports.out')} value={`−${money(a.out)}`} />
            <Line label={t('reports.closing')} value={money(a.closing)} strong />
          </Card>
        ))}
      </SimpleGrid>
      {c.flows.length > 0 && (
        <Card withBorder p={0}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('reports.flow')}</Table.Th>
                <Table.Th ta="end">{t('reports.in')}</Table.Th>
                <Table.Th ta="end">{t('reports.out')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {c.flows.map((f) => (
                <Table.Tr key={f.event}>
                  <Table.Td>{t(`reports.event.${f.event}`, { defaultValue: f.event })}</Table.Td>
                  <Table.Td ta="end">{Number(f.in) ? money(f.in) : ''}</Table.Td>
                  <Table.Td ta="end">{Number(f.out) ? money(f.out) : ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}

function Methods({ range }: { range: ReportRange }) {
  const { t } = useTranslation();
  const money = useMoney();
  const query = usePaymentMethods(range);
  if (!query.data) return <Loading query={query} />;
  if (!query.data.length) return <EmptyState />;
  const purpose = (p: string) => t(`sales.purpose.${p}`, { defaultValue: p });
  return (
    <Stack>
      <Group justify="flex-end">
        <Export
          name={`payment-methods-${range.from}-${range.to}`}
          rows={() => [
            [
              t('suppliers.method'),
              t('reports.purpose'),
              t('reports.direction'),
              t('reports.count'),
              t('sales.amount'),
            ],
            ...query.data.map((r) => [
              t(`sales.method.${r.method}`),
              purpose(r.purpose),
              r.direction,
              r.count,
              r.amount,
            ]),
          ]}
        />
      </Group>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={480}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('suppliers.method')}</Table.Th>
                <Table.Th>{t('reports.purpose')}</Table.Th>
                <Table.Th ta="end">{t('reports.count')}</Table.Th>
                <Table.Th ta="end">{t('sales.amount')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {query.data.map((r) => (
                <Table.Tr key={`${r.method}-${r.purpose}-${r.direction}`}>
                  <Table.Td>{t(`sales.method.${r.method}`)}</Table.Td>
                  <Table.Td>{purpose(r.purpose)}</Table.Td>
                  <Table.Td ta="end">{r.count}</Table.Td>
                  <Table.Td ta="end" c={r.direction === 'OUT' ? 'red' : undefined}>
                    {r.direction === 'OUT' ? '−' : ''}
                    {money(r.amount)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}

// ------------------------------------------------------------------ debts

function AgingHead() {
  const { t } = useTranslation();
  return (
    <>
      <Table.Th ta="end">{t('reports.aging.current')}</Table.Th>
      <Table.Th ta="end">{t('reports.aging.days30')}</Table.Th>
      <Table.Th ta="end">{t('reports.aging.days60')}</Table.Th>
      <Table.Th ta="end">{t('reports.aging.days90')}</Table.Th>
    </>
  );
}

function AgingCells({ a }: { a: AgingBuckets }) {
  const money = useMoney();
  const cell = (v: string, late = false) => (
    <Table.Td ta="end" c={late && Number(v) > 0 ? 'red' : undefined}>
      {Number(v) ? money(v) : ''}
    </Table.Td>
  );
  return (
    <>
      {cell(a.current)}
      {cell(a.days30)}
      {cell(a.days60, true)}
      {cell(a.days90, true)}
    </>
  );
}

const agingCsv = (a: AgingBuckets) => [a.current, a.days30, a.days60, a.days90];

function Debts() {
  const { t } = useTranslation();
  const money = useMoney();
  const query = useDebts();
  if (!query.data) return <Loading query={query} />;
  const d = query.data;
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm">
          {t('reports.customerCredit')}: <b>{money(d.totals.customerCredit)}</b>
        </Text>
        <Export
          name="customer-debts"
          rows={() => [
            [
              t('customers.name'),
              t('customers.phone'),
              t('reports.owed'),
              t('reports.aging.current'),
              t('reports.aging.days30'),
              t('reports.aging.days60'),
              t('reports.aging.days90'),
              t('reports.oldest'),
            ],
            ...d.customers.map((c) => [c.name, c.phone, c.owed, ...agingCsv(c.aging), c.oldest]),
          ]}
        />
      </Group>
      {d.customers.length === 0 ? (
        <EmptyState />
      ) : (
        <Card withBorder p={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('customers.name')}</Table.Th>
                  <Table.Th ta="end">{t('reports.owed')}</Table.Th>
                  <AgingHead />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.customers.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/customers/${c.id}`} size="sm">
                        {c.name}
                      </Anchor>
                      {c.phone && (
                        <Text size="xs" c="dimmed" dir="ltr" ta="start">
                          {c.phone}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="end" fw={600}>
                      {money(c.owed)}
                    </Table.Td>
                    <AgingCells a={c.aging} />
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td fw={700}>{t('reports.total')}</Table.Td>
                  <Table.Td ta="end" fw={700}>
                    {money(d.totals.owed)}
                  </Table.Td>
                  <AgingCells a={d.totals.aging} />
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

function SupplierDebts() {
  const { t } = useTranslation();
  const money = useMoney();
  const query = useSupplierDebts();
  if (!query.data) return <Loading query={query} />;
  const d = query.data;
  if (d.suppliers.length === 0) return <EmptyState />;
  return (
    <Stack>
      <Group justify="flex-end">
        <Export
          name="supplier-debts"
          rows={() => [
            [
              t('purchasing.supplier'),
              t('reports.owed'),
              t('reports.aging.current'),
              t('reports.aging.days30'),
              t('reports.aging.days60'),
              t('reports.aging.days90'),
              t('reports.oldest'),
            ],
            ...d.suppliers.map((s) => [s.name, s.owed, ...agingCsv(s.aging), s.oldest]),
          ]}
        />
      </Group>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('purchasing.supplier')}</Table.Th>
                <Table.Th ta="end">{t('reports.owed')}</Table.Th>
                <AgingHead />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.suppliers.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/suppliers/${s.id}`} size="sm">
                      {s.name}
                    </Anchor>
                  </Table.Td>
                  <Table.Td ta="end" fw={600}>
                    {money(s.owed)}
                  </Table.Td>
                  <AgingCells a={s.aging} />
                </Table.Tr>
              ))}
              <Table.Tr>
                <Table.Td fw={700}>{t('reports.total')}</Table.Td>
                <Table.Td ta="end" fw={700}>
                  {money(d.totals.owed)}
                </Table.Td>
                <AgingCells a={d.totals.aging} />
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}

// ------------------------------------------------------------------ inventory and daily

function Inventory() {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useInventory();
  const name = (n: string | { ar?: string; en?: string; he?: string }) =>
    typeof n === 'string' ? n : localize(n, i18n.language);
  if (!query.data) return <Loading query={query} />;
  const v = query.data;
  const reconciled = v.totals.value === v.totals.ledger;
  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label={t('reports.pieces')} value={String(v.totals.pieces)} />
        <Stat label={t('reports.atCost')} value={money(v.totals.value)} />
        <Stat label={t('reports.atPrice')} value={money(v.totals.retail)} />
        <Stat label={t('reports.damagedPieces')} value={String(v.totals.damaged)} />
      </SimpleGrid>
      <Alert color={reconciled ? 'green' : 'orange'}>
        {reconciled
          ? t('reports.reconciled')
          : t('reports.notReconciled', { ledger: money(v.totals.ledger) })}
        {v.totals.unknownCost > 0 &&
          ` ${t('reports.unknownCost', { count: v.totals.unknownCost })}`}
      </Alert>
      <Group justify="flex-end">
        <Export
          name="inventory-value"
          rows={() => [
            [
              t('catalogue.category'),
              t('reports.pieces'),
              t('reports.atCost'),
              t('reports.atPrice'),
            ],
            ...v.categories.map((c) => [name(c.name), c.pieces, c.value, c.retail]),
          ]}
        />
      </Group>
      <Card withBorder p={0}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('catalogue.category')}</Table.Th>
              <Table.Th ta="end">{t('reports.pieces')}</Table.Th>
              <Table.Th ta="end">{t('reports.atCost')}</Table.Th>
              <Table.Th ta="end">{t('reports.atPrice')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {v.categories.map((c) => (
              <Table.Tr key={c.id ?? 'none'}>
                <Table.Td>{name(c.name)}</Table.Td>
                <Table.Td ta="end">{c.pieces}</Table.Td>
                <Table.Td ta="end">{money(c.value)}</Table.Td>
                <Table.Td ta="end">{money(c.retail)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

function Daily({ date }: { date: string }) {
  const { t } = useTranslation();
  const money = useMoney();
  const query = useDaily(date);
  const methods = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of query.data?.payments ?? [])
      m.set(p.method, (m.get(p.method) ?? 0) + (p.direction === 'IN' ? 1 : -1) * Number(p.amount));
    return [...m];
  }, [query.data]);
  if (!query.data) return <Loading query={query} />;
  const d = query.data;
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <Card withBorder>
        <Line label={t('reports.salesCount')} value={String(d.sales.count)} />
        <Line label={t('reports.pieces')} value={String(d.sales.pieces)} />
        <Line label={t('reports.salesTotal')} value={money(d.sales.total)} strong />
        <Line
          label={t('reports.returnsCount', { count: d.returns.count })}
          value={`−${money(d.returns.total)}`}
          muted
        />
        {d.grossProfit !== null && (
          <Line label={t('reports.grossProfit')} value={money(d.grossProfit)} strong />
        )}
        <Text fw={600} mt="sm" mb={4}>
          {t('today.byMethod')}
        </Text>
        {methods.map(([m, v]) => (
          <Line key={m} label={t(`sales.method.${m}`)} value={money(v.toFixed(2))} />
        ))}
        {d.expenses.length > 0 && (
          <>
            <Text fw={600} mt="sm" mb={4}>
              {t('reports.expenses')}
            </Text>
            {d.expenses.map((e) => (
              <Line
                key={e.category}
                label={t(`shifts.expense.${e.category}`, { defaultValue: e.category })}
                value={money(e.amount)}
              />
            ))}
          </>
        )}
      </Card>
      <Card withBorder>
        <Text fw={600} mb="xs">
          {t('nav.shifts')}
        </Text>
        {d.shifts.length === 0 && <EmptyState />}
        <Stack gap={4}>
          {d.shifts.map((s) => (
            <Group key={s.id} justify="space-between">
              <Anchor component={Link} to={`/shifts/${s.id}`} size="sm">
                <span dir="ltr">{s.number}</span> · {s.register} · {s.openedBy}
              </Anchor>
              <Text size="sm" c={s.difference && Number(s.difference) !== 0 ? 'red' : 'dimmed'}>
                {s.difference !== null ? money(s.difference) : t(`shifts.status.${s.status}`)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
