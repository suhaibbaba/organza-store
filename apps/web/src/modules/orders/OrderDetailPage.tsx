import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  addMoney,
  EDITABLE_ORDER_STATUSES,
  fromMinor,
  localize,
  type OrderView,
  toMinor,
} from '@organza/shared';
import {
  IconBrandWhatsapp,
  IconDots,
  IconEdit,
  IconListCheck,
  IconPhone,
  IconPhoto,
  IconRefresh,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useDefaultCurrency } from '@web/modules/settings/api';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDateTime } from '@web/shared/lib/format';
import { useCouriers, useOpenShiftId, useOrder, useOrderActions } from './api';
import { type DraftLine, OrderLinesEditor } from './OrderLinesEditor';
import { ORDER_STATUS_COLORS, SOURCE_COLORS } from './OrdersPage';
import classes from './orders.module.css';

type Dialog = 'ship' | 'collect' | 'returned' | 'cancel' | 'deposit' | 'edit' | null;

const neg = (v: string) => fromMinor(-toMinor(v));
const HOLDING = ['CONFIRMED', 'PREPARING', 'READY'];

/** Digits only, Palestinian/Israeli local numbers turned international for WhatsApp links. */
const whatsappNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `970${digits.slice(1)}` : digits;
};

export function OrderDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const query = useOrder(id);
  const actions = useOrderActions();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const o = query.data;
  const fulfil = can('orders.fulfil');
  const due = addMoney(o.total, neg(o.deposit));
  const finished = ['OUT', 'COLLECTED', 'CANCELLED', 'RETURNED'].includes(o.status);

  const step = (s: 'confirm' | 'prepare' | 'ready' | 'reserve') =>
    actions.step.mutate(
      { id: o.id, step: s },
      { onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }) },
    );

  const primary = (() => {
    if (!fulfil) return null;
    switch (o.status) {
      case 'NEW':
        return { label: t('orders.do.confirm'), run: () => step('confirm') };
      case 'CONFIRMED':
        return { label: t('orders.do.prepare'), run: () => step('prepare') };
      case 'PREPARING':
        return { label: t('orders.do.ready'), run: () => step('ready') };
      case 'READY':
        return o.delivery === 'COURIER'
          ? { label: t('orders.do.ship'), run: () => setDialog('ship') }
          : { label: t('orders.do.collect'), run: () => setDialog('collect') };
      default:
        return null;
    }
  })();

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Group gap="xs">
            <Title order={2} size="h3" dir="ltr">
              {o.number}
            </Title>
            <Badge color={ORDER_STATUS_COLORS[o.status]}>{t(`orders.status.${o.status}`)}</Badge>
            <Badge variant="light" color={SOURCE_COLORS[o.source]}>
              {t(`orders.source.${o.source}`)}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {formatDateTime(o.createdAt, i18n.language)} · {t(`orders.delivery.${o.delivery}`)}
            {o.courier ? ` · ${o.courier.name}` : ''}
          </Text>
        </Stack>
        <Group gap="xs">
          {primary && (
            <Button loading={actions.step.isPending} onClick={primary.run}>
              {primary.label}
            </Button>
          )}
          {o.status === 'OUT' && fulfil && (
            <Button variant="light" color="red" onClick={() => setDialog('returned')}>
              {t('orders.do.returned')}
            </Button>
          )}
          <Button
            variant="default"
            leftSection={<IconListCheck size={16} />}
            onClick={() => navigate(`/orders/pick?ids=${o.id}`)}
          >
            {t('orders.slip')}
          </Button>
          {!finished && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label={t('common.more')}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {can('orders.create') && (
                  <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => setDialog('edit')}>
                    {t('common.edit')}
                  </Menu.Item>
                )}
                {fulfil && ['CONFIRMED', 'PREPARING'].includes(o.status) && o.short > 0 && (
                  <Menu.Item
                    leftSection={<IconRefresh size={14} />}
                    onClick={() => step('reserve')}
                  >
                    {t('orders.do.reserve')}
                  </Menu.Item>
                )}
                {can('payments.receive') && (
                  <Menu.Item onClick={() => setDialog('deposit')}>
                    {t('orders.do.deposit')}
                  </Menu.Item>
                )}
                {can('orders.cancel') && (
                  <Menu.Item color="red" onClick={() => setDialog('cancel')}>
                    {t('orders.do.cancel')}
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      {o.short > 0 && (
        <Alert color="red" mb="md">
          {t('orders.shortHint', { count: o.short })}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Stack gap="md" style={{ gridColumn: 'span 2' }}>
          <Card withBorder>
            <Text fw={600} mb="xs">
              {t('orders.lines')}
            </Text>
            <Stack gap={6}>
              {o.lines.map((l) => (
                <Group
                  key={l.id}
                  wrap="nowrap"
                  gap="sm"
                  p={4}
                  className={
                    l.reserved < l.quantity && HOLDING.includes(o.status)
                      ? classes.lineShort
                      : undefined
                  }
                >
                  {l.imageUrl ? (
                    <img
                      src={l.imageUrl}
                      alt=""
                      width={48}
                      height={64}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  ) : (
                    <Center w={48} h={64} bg="gray.1" style={{ borderRadius: 4 }}>
                      <IconPhoto size={16} />
                    </Center>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Anchor component={Link} to={`/products/${l.productId}`} size="sm" fw={600}>
                      {localize(l.name, i18n.language)}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {[
                        l.variantLabel ? localize(l.variantLabel, i18n.language) : null,
                        l.sku,
                        l.location,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {['CONFIRMED', 'PREPARING', 'READY'].includes(o.status) && (
                      <Text size="xs" c={l.reserved < l.quantity ? 'red' : 'green.8'}>
                        {t('orders.reservedOf', { reserved: l.reserved, quantity: l.quantity })}
                      </Text>
                    )}
                    {Number(l.currentPrice) > Number(l.unitPrice) && !finished && (
                      <Text size="xs" c="orange.8">
                        {t('orders.quoteKept', { price: money(l.currentPrice) })}
                      </Text>
                    )}
                  </div>
                  <Text size="sm">× {l.quantity}</Text>
                  <Text size="sm" fw={600} w={90} ta="end">
                    {money(l.lineTotal)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
          <Card withBorder>
            <Text fw={600} mb="xs">
              {t('orders.timeline')}
            </Text>
            <Timeline bulletSize={14} lineWidth={2} active={o.events.length}>
              {o.events.map((e) => (
                <Timeline.Item key={e.id} title={t(`orders.status.${e.to}`)}>
                  <Text size="xs" c="dimmed">
                    {e.by} · {formatDateTime(e.at, i18n.language)}
                  </Text>
                  {e.note && <Text size="sm">{e.note}</Text>}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Stack>

        <Stack gap="md">
          <Card withBorder>
            <Text fw={600}>{o.customer.name}</Text>
            {o.customer.phone && (
              <Group gap="xs" mt={4}>
                <Text size="sm" dir="ltr">
                  {o.customer.phone}
                </Text>
                <ActionIcon
                  component="a"
                  href={`tel:${o.customer.phone}`}
                  variant="light"
                  aria-label={t('orders.call')}
                >
                  <IconPhone size={16} />
                </ActionIcon>
                <ActionIcon
                  component="a"
                  href={`https://wa.me/${whatsappNumber(o.customer.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="light"
                  color="green"
                  aria-label="WhatsApp"
                >
                  <IconBrandWhatsapp size={16} />
                </ActionIcon>
              </Group>
            )}
            {(o.city || o.address) && (
              <Text size="sm" mt={4}>
                {[o.city, o.address].filter(Boolean).join(' · ')}
              </Text>
            )}
            {o.note && (
              <Text size="sm" c="dimmed" mt={4}>
                {o.note}
              </Text>
            )}
            <Anchor component={Link} to={`/customers/${o.customer.id}`} size="xs">
              {t('orders.customerPage')}
            </Anchor>
          </Card>
          <Card withBorder>
            <Stack gap={4}>
              <Row label={t('sales.total')} value={money(o.total)} strong />
              {Number(o.deposit) > 0 && (
                <Row label={t('orders.deposit')} value={money(o.deposit)} />
              )}
              {!finished && <Row label={t('orders.due')} value={money(due)} />}
              {Number(o.cod) > 0 && <Row label={t('orders.cod')} value={money(o.cod)} />}
              {Number(o.cod) > 0 && <Row label={t('orders.settled')} value={money(o.settled)} />}
              {o.sale && (
                <Anchor component={Link} to={`/sales/${o.sale.id}`} size="sm">
                  {t('orders.saleLink', { number: o.sale.number })}
                </Anchor>
              )}
              {o.cancelReason && (
                <Text size="sm" c="red">
                  {o.cancelReason}
                </Text>
              )}
            </Stack>
            {o.deposits.length > 0 && (
              <Stack gap={2} mt="sm">
                {o.deposits.map((p) => (
                  <Text key={p.id} size="xs" c="dimmed">
                    <span dir="ltr">{p.number}</span> · {t(`sales.method.${p.method}`)} ·{' '}
                    {money(p.amountDefault)}
                  </Text>
                ))}
              </Stack>
            )}
          </Card>
        </Stack>
      </SimpleGrid>

      {dialog === 'ship' && <ShipDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === 'collect' && <CollectDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === 'returned' && <ReturnedDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === 'deposit' && <DepositDialog order={o} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditDialog order={o} onClose={() => setDialog(null)} />}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Group justify="space-between">
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={strong ? 700 : 500}>
        {value}
      </Text>
    </Group>
  );
}

function useRun(onClose: () => void) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  return async (work: () => Promise<unknown>) => {
    try {
      await work();
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
}

function ShipDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const couriers = useCouriers();
  const { ship } = useOrderActions();
  const shiftId = useOpenShiftId();
  const run = useRun(onClose);
  const [courierId, setCourierId] = useState<string | null>(o.courier?.id ?? null);
  const due = addMoney(o.total, neg(o.deposit));
  return (
    <Modal opened onClose={onClose} title={t('orders.do.ship')} centered>
      <Stack>
        <Select
          label={t('orders.courier')}
          required
          value={courierId}
          onChange={setCourierId}
          data={(couriers.data ?? [])
            .filter((c) => c.isActive)
            .map((c) => ({ value: c.id, label: c.name }))}
        />
        <Alert color="blue" variant="light">
          {Number(due) > 0 ? t('orders.codHint', { amount: money(due) }) : t('orders.prepaidHint')}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!courierId}
            loading={ship.isPending}
            onClick={() =>
              void run(() =>
                ship.mutateAsync({
                  id: o.id,
                  courierId: courierId ?? undefined,
                  shiftId: o.source === 'COUNTER' ? shiftId : undefined,
                }),
              )
            }
          >
            {t('orders.do.ship')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const METHODS = ['CASH', 'CARD', 'BANK_TRANSFER'] as const;

function CollectDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const currency = useDefaultCurrency();
  const { collect } = useOrderActions();
  const shiftId = useOpenShiftId();
  const run = useRun(onClose);
  const due = addMoney(o.total, neg(o.deposit));
  const [method, setMethod] = useState<(typeof METHODS)[number]>('CASH');
  const [amount, setAmount] = useState(Number(due) > 0 ? due : '');
  const [key] = useState(newIdempotencyKey);
  const paying = Number(amount) > 0;
  const owed = Number(due) - (Number(amount) || 0);
  return (
    <Modal opened onClose={onClose} title={t('orders.do.collect')} centered>
      <Stack>
        <Text>{t('orders.dueNow', { amount: money(due) })}</Text>
        <SegmentedControl
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          data={METHODS.map((m) => ({ value: m, label: t(`sales.method.${m}`) }))}
        />
        <MoneyInput label={t('sales.amount')} value={amount} onChange={setAmount} />
        {owed > 0 && (
          <Alert color="orange" variant="light">
            {t('orders.leftAsDebt', { amount: money(owed.toFixed(2)) })}
          </Alert>
        )}
        {method === 'CASH' && paying && !shiftId && (
          <Alert color="red">{t('shifts.noOpenShift')}</Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            loading={collect.isPending}
            disabled={method === 'CASH' && paying && !shiftId}
            onClick={() =>
              void run(() =>
                collect.mutateAsync({
                  id: o.id,
                  key,
                  shiftId,
                  payments: paying
                    ? [{ method, currency: currency ?? 'ILS', amount: Number(amount).toFixed(2) }]
                    : [],
                }),
              )
            }
          >
            {t('orders.do.collect')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ReturnedDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { returned } = useOrderActions();
  const shiftId = useOpenShiftId();
  const run = useRun(onClose);
  const [reason, setReason] = useState('');
  const [key] = useState(newIdempotencyKey);
  const [conditions, setConditions] = useState<Record<string, 'SHELF' | 'DAMAGED'>>({});
  return (
    <Modal opened onClose={onClose} title={t('orders.do.returned')} centered size="lg">
      <Stack>
        <Text size="sm">{t('orders.returnedHint')}</Text>
        {o.lines.map((l) => (
          <Group key={l.id} justify="space-between" wrap="nowrap">
            <Text size="sm" truncate>
              {localize(l.name, i18n.language)} × {l.quantity}
            </Text>
            <SegmentedControl
              size="xs"
              value={conditions[l.id] ?? 'SHELF'}
              onChange={(v) => setConditions({ ...conditions, [l.id]: v as 'SHELF' | 'DAMAGED' })}
              data={[
                { value: 'SHELF', label: t('returns.condition.SHELF') },
                { value: 'DAMAGED', label: t('returns.condition.DAMAGED') },
              ]}
            />
          </Group>
        ))}
        <Textarea
          label={t('common.reason')}
          required
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            color="red"
            disabled={reason.trim().length < 3}
            loading={returned.isPending}
            onClick={() =>
              void run(() =>
                returned.mutateAsync({
                  id: o.id,
                  key,
                  shiftId,
                  reason: reason.trim(),
                  lines: o.lines.map((l) => ({
                    lineId: l.id,
                    condition: conditions[l.id] ?? 'SHELF',
                  })),
                }),
              )
            }
          >
            {t('orders.do.returned')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CancelDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { cancel } = useOrderActions();
  const run = useRun(onClose);
  const [reason, setReason] = useState('');
  return (
    <Modal opened onClose={onClose} title={t('orders.do.cancel')} centered>
      <Stack>
        {Number(o.deposit) > 0 && (
          <Alert color="blue" variant="light">
            {t('orders.cancelDepositHint', { amount: money(o.deposit) })}
          </Alert>
        )}
        <Textarea
          label={t('common.reason')}
          required
          data-autofocus
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            color="red"
            disabled={reason.trim().length < 3}
            loading={cancel.isPending}
            onClick={() => void run(() => cancel.mutateAsync({ id: o.id, reason: reason.trim() }))}
          >
            {t('orders.do.cancel')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function DepositDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t } = useTranslation();
  const currency = useDefaultCurrency();
  const { deposit } = useOrderActions();
  const shiftId = useOpenShiftId();
  const run = useRun(onClose);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('BANK_TRANSFER');
  const [amount, setAmount] = useState('');
  const [key] = useState(newIdempotencyKey);
  const blocked = method === 'CASH' && !shiftId;
  return (
    <Modal opened onClose={onClose} title={t('orders.do.deposit')} centered>
      <Stack>
        <Text size="sm" c="dimmed">
          {t('orders.depositHint')}
        </Text>
        <SegmentedControl
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          data={METHODS.map((m) => ({ value: m, label: t(`sales.method.${m}`) }))}
        />
        <MoneyInput label={t('sales.amount')} required value={amount} onChange={setAmount} />
        {blocked && <Alert color="red">{t('shifts.noOpenShift')}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!(Number(amount) > 0) || blocked}
            loading={deposit.isPending}
            onClick={() =>
              void run(() =>
                deposit.mutateAsync({
                  id: o.id,
                  key,
                  shiftId: method === 'CASH' ? shiftId : undefined,
                  payment: {
                    method,
                    currency: currency ?? 'ILS',
                    amount: Number(amount).toFixed(2),
                  },
                }),
              )
            }
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function EditDialog({ order: o, onClose }: { order: OrderView; onClose: () => void }) {
  const { t } = useTranslation();
  const couriers = useCouriers();
  const { update } = useOrderActions();
  const run = useRun(onClose);
  const linesEditable = EDITABLE_ORDER_STATUSES.includes(o.status);
  const [courierId, setCourierId] = useState<string | null>(o.courier?.id ?? null);
  const [city, setCity] = useState(o.city ?? '');
  const [address, setAddress] = useState(o.address ?? '');
  const [note, setNote] = useState(o.note ?? '');
  const [lines, setLines] = useState<DraftLine[]>(
    o.lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      variantLabel: l.variantLabel,
      sku: l.sku,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      reserved: ['CONFIRMED', 'PREPARING'].includes(o.status) ? l.reserved : undefined,
    })),
  );
  return (
    <Modal opened onClose={onClose} title={t('common.edit')} centered size="lg">
      <Stack>
        {o.delivery === 'COURIER' && (
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Select
              label={t('orders.courier')}
              clearable
              value={courierId}
              onChange={setCourierId}
              data={(couriers.data ?? [])
                .filter((c) => c.isActive || c.id === o.courier?.id)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
            <TextInputLite label={t('orders.city')} value={city} onChange={setCity} />
            <TextInputLite label={t('orders.address')} value={address} onChange={setAddress} />
          </SimpleGrid>
        )}
        <Textarea
          label={t('common.note')}
          autosize
          minRows={1}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {linesEditable ? (
          <OrderLinesEditor lines={lines} onChange={setLines} />
        ) : (
          <Text size="sm" c="dimmed">
            {t('orders.linesFixed')}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            loading={update.isPending}
            disabled={linesEditable && lines.length === 0}
            onClick={() =>
              void run(() =>
                update.mutateAsync({
                  id: o.id,
                  body: {
                    version: o.version,
                    courierId: o.delivery === 'COURIER' ? courierId : undefined,
                    city,
                    address,
                    note,
                    ...(linesEditable && {
                      lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
                    }),
                  },
                }),
              )
            }
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function TextInputLite({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      label={label}
      autosize
      minRows={1}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
