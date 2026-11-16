import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  addMoney,
  compareMoney,
  type CustomerView,
  fromMinor,
  multiplyMoney,
  type TillPaymentMethod,
  toMinor,
} from '@organza/shared';
import { IconBrandWhatsapp, IconCash, IconEdit, IconPhone } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useCurrencies } from '@web/modules/settings/api';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDate } from '@web/shared/lib/format';
import {
  deviceRegister,
  useCustomer,
  useOpenSales,
  useReceivePayment,
  useRegisters,
  useSales,
  useStatement,
} from './api';
import { CustomerForm } from './CustomerForm';
import { SaleList } from './SalesPage';

export function CustomerDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const money = useMoney();
  const { can } = useSession();
  const query = useCustomer(id);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;
  const wa = (c.whatsapp ?? c.phone)?.replace(/\D/g, '');

  return (
    <>
      <PageHeader
        title={c.name}
        back={{ to: '/customers', label: t('nav.customers') }}
        actions={
          <>
            {can('payments.receive') && (
              <Button leftSection={<IconCash size={16} />} onClick={() => setPaying(true)}>
                {t('customers.receivePayment')}
              </Button>
            )}
            {can('customers.edit') && (
              <Button
                variant="default"
                leftSection={<IconEdit size={16} />}
                onClick={() => setEditing(true)}
              >
                {t('common.edit')}
              </Button>
            )}
          </>
        }
      />
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Balance
            label={t('customers.debt')}
            value={money(c.debt)}
            color={Number(c.debt) > 0 ? 'red.7' : undefined}
          />
          <Balance
            label={t('customers.credit')}
            value={money(c.credit)}
            color={Number(c.credit) > 0 ? 'green.8' : undefined}
          />
          <Balance label={t('customers.depositsLabel')} value={money(c.deposits)} />
        </SimpleGrid>
        <Card withBorder>
          <Group gap="md">
            {c.phone && (
              <Button
                component="a"
                href={`tel:${c.phone}`}
                variant="subtle"
                leftSection={<IconPhone size={16} />}
              >
                <span dir="ltr">{c.phone}</span>
              </Button>
            )}
            {wa && (
              <Button
                component="a"
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                variant="subtle"
                color="green"
                leftSection={<IconBrandWhatsapp size={16} />}
              >
                WhatsApp
              </Button>
            )}
            {[c.city, c.address].filter(Boolean).length > 0 && (
              <Text size="sm">{[c.city, c.address].filter(Boolean).join(' · ')}</Text>
            )}
          </Group>
          {c.notes && (
            <Text size="sm" mt="xs" c="dimmed">
              {c.notes}
            </Text>
          )}
        </Card>
        <Tabs defaultValue="statement" keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="statement">{t('customers.statement')}</Tabs.Tab>
            <Tabs.Tab value="sales">{t('nav.sales')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="statement" pt="sm">
            <Statement id={c.id} />
          </Tabs.Panel>
          <Tabs.Panel value="sales" pt="sm">
            <CustomerSales id={c.id} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
      <CustomerForm opened={editing} onClose={() => setEditing(false)} customer={c} />
      {paying && <ReceivePaymentDialog customer={c} onClose={() => setPaying(false)} />}
    </>
  );
}

function Balance({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={700} c={color}>
        {value}
      </Text>
    </Card>
  );
}

const STATEMENT_LINK: Record<string, (id: string) => string | null> = {
  SALE: (id) => `/sales/${id}`,
  HANDOVER: (id) => `/sales/${id}`,
  CANCEL: (id) => `/sales/${id}`,
};

function Statement({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useStatement(id);
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState />;
  return (
    <Card p={0}>
      {' '}
      <Table.ScrollContainer minWidth={520}>
        <Table striped verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('customers.date')}</Table.Th>
              <Table.Th>{t('customers.entry')}</Table.Th>
              <Table.Th ta="end">{t('customers.amount')}</Table.Th>
              <Table.Th ta="end">{t('customers.balance')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {query.data.map((r, i) => {
              const link = STATEMENT_LINK[r.kind]?.(r.sourceId);
              const amount = Number(r.amount);
              const balance = Number(r.balance);
              return (
                <Table.Tr key={i}>
                  <Table.Td>{formatDate(r.date, i18n.language)}</Table.Td>
                  <Table.Td>
                    {t(`customers.kind.${r.kind}`)}{' '}
                    {r.number &&
                      (link ? (
                        <Link to={link} dir="ltr">
                          {r.number}
                        </Link>
                      ) : (
                        <span dir="ltr">{r.number}</span>
                      ))}
                  </Table.Td>
                  <Table.Td ta="end" c={amount > 0 ? 'red.7' : 'green.8'}>
                    {amount > 0 ? '+' : '−'}
                    {money(String(Math.abs(amount)))}
                  </Table.Td>
                  <Table.Td ta="end" fw={600}>
                    {balance === 0
                      ? money('0')
                      : balance > 0
                        ? t('customers.owes', { amount: money(String(balance)) })
                        : t('customers.hasCredit', { amount: money(String(-balance)) })}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function CustomerSales({ id }: { id: string }) {
  const query = useSales({ customerId: id });
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) return <EmptyState />;
  return <SaleList sales={query.data.items} />;
}

/** Take money from a customer: pays their oldest sales first, or the ones picked; rest is credit. */
function ReceivePaymentDialog({
  customer,
  onClose,
}: {
  customer: CustomerView;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const currencies = useCurrencies();
  const registers = useRegisters();
  const open = useOpenSales(customer.id);
  const receive = useReceivePayment();
  const defaultCurrency = currencies.data?.find((c) => c.isDefault)?.code ?? 'ILS';
  const active = (currencies.data ?? []).filter((c) => c.isActive && (c.isDefault || c.rateSetAt));
  const [method, setMethod] = useState<TillPaymentMethod>('CASH');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [pick, setPick] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [key] = useState(newIdempotencyKey);
  useEffect(() => setCurrency(defaultCurrency), [defaultCurrency]);

  const deviceId = deviceRegister.get();
  const shiftId =
    (registers.data ?? []).find((r) => r.id === deviceId)?.openShift?.id ??
    (registers.data ?? []).find((r) => r.openShift)?.openShift?.id;
  const rate = active.find((c) => c.code === currency)?.rate ?? '1';
  const value = isMoney(amount)
    ? currency === defaultCurrency
      ? amount
      : multiplyMoney(amount, rate)
    : '0';
  const sales = useMemo(() => (open.data ?? []).filter((s) => Number(s.open) > 0), [open.data]);

  // Picked sales are paid in the order shown, each up to what it still owes.
  const allocations = (() => {
    if (!pick) return undefined;
    let left = value;
    const out: { saleId: string; amount: string }[] = [];
    for (const s of sales) {
      if (!picked[s.id] || compareMoney(left, 0) <= 0) continue;
      const take = compareMoney(left, s.open) < 0 ? left : s.open;
      out.push({ saleId: s.id, amount: take });
      left = addMoney(left, fromMinor(-toMinor(take)));
    }
    return out;
  })();

  const submit = async () => {
    try {
      const receipt = await receive.mutateAsync({
        customerId: customer.id,
        idempotencyKey: key,
        shiftId: method === 'CASH' ? shiftId : undefined,
        payments: [
          {
            method,
            currency: method === 'CASH' ? currency : defaultCurrency,
            amount: Number(amount).toFixed(2),
            rate: method === 'CASH' && currency !== defaultCurrency ? rate : undefined,
            reference: reference || undefined,
          },
        ],
        allocations,
      });
      notifications.show({
        color: 'green',
        message:
          Number(receipt.toCredit) > 0
            ? t('customers.paymentSavedCredit', { amount: money(receipt.toCredit) })
            : t('customers.paymentSaved'),
      });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('customers.receivePayment')} centered size="md">
      <Stack>
        {Number(customer.debt) > 0 && (
          <Text size="sm">{t('customers.owes', { amount: money(customer.debt) })}</Text>
        )}
        <SegmentedControl
          value={method}
          onChange={(v) => setMethod(v as TillPaymentMethod)}
          data={(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map((m) => ({
            value: m,
            label: t(`sales.method.${m}`),
          }))}
        />
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <MoneyInput
            data-autofocus
            label={t('pos.amount')}
            value={amount}
            onChange={setAmount}
            style={{ flex: 1 }}
          />
          {method === 'CASH' && active.length > 1 && (
            <Select
              w={100}
              value={currency}
              onChange={(v) => v && setCurrency(v)}
              data={active.map((c) => c.code)}
              allowDeselect={false}
            />
          )}
        </Group>
        {method !== 'CASH' && (
          <TextInput
            label={t('pos.reference')}
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        )}
        {method === 'CASH' && !shiftId && (
          <Alert color="orange" variant="light">
            {t('errors.SHIFT_REQUIRED')}
          </Alert>
        )}
        {sales.length > 0 && (
          <Checkbox
            label={t('customers.pickSales')}
            checked={pick}
            onChange={(e) => setPick(e.currentTarget.checked)}
          />
        )}
        {pick && (
          <Stack gap={4}>
            {sales.map((s) => (
              <Checkbox
                key={s.id}
                checked={Boolean(picked[s.id])}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setPicked((p) => ({ ...p, [s.id]: checked }));
                }}
                label={
                  <Group gap={6}>
                    <span dir="ltr">{s.number}</span>
                    <Text size="sm" c="dimmed">
                      {formatDate(s.createdAt, i18n.language)}
                    </Text>
                    <Badge size="sm" variant="light" color="red">
                      {money(s.open)}
                    </Badge>
                  </Group>
                }
              />
            ))}
          </Stack>
        )}
        <Text size="xs" c="dimmed">
          {pick ? t('customers.pickedHint') : t('customers.oldestFirstHint')}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void submit()}
            loading={receive.isPending}
            disabled={!isMoney(amount) || Number(amount) <= 0 || (method === 'CASH' && !shiftId)}
          >
            {t('customers.receive')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
