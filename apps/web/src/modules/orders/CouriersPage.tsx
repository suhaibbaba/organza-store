import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addMoney, type CourierView, fromMinor, toMinor } from '@organza/shared';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { PageHeader } from '@web/shared/components/PageHeader';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDateTime } from '@web/shared/lib/format';
import { useCourierActions, useCouriers, useOpenShiftId, useOrders, useSettlements } from './api';
import classes from './orders.module.css';

/** Delivery companies: what each owes, its open parcels, and its settlements. */
export function CouriersPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const money = useMoney();
  const query = useCouriers();
  const [editing, setEditing] = useState<CourierView | 'new' | null>(null);
  const [settling, setSettling] = useState<CourierView | null>(null);
  const [history, setHistory] = useState<CourierView | null>(null);

  return (
    <>
      <PageHeader
        title={t('nav.couriers')}
        primary={
          can('couriers.manage') && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
              {t('couriers.add')}
            </Button>
          )
        }
      />
      {query.isPending && <FullScreenLoader />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data?.length === 0 && <EmptyState />}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {query.data?.map((c) => (
          <Card key={c.id}>
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Stack gap={0} className="ds-min-0">
                  <h2 className="ds-heading ds-truncate">{c.name}</h2>
                  {c.phone && (
                    <Text size="sm" className="ds-ltr ds-muted ds-num">
                      {c.phone}
                    </Text>
                  )}
                </Stack>
                {!c.isActive && <Badge color="gray">{t('common.inactive')}</Badge>}
              </Group>
              <div className={classes.kpi}>
                <span className="ds-eyebrow">{t('couriers.owes')}</span>
                <span className={`ds-figure ${Number(c.balance) > 0 ? classes.owed : ''}`}>
                  {money(c.balance)}
                </span>
                <Text size="xs" className="ds-muted">
                  {t('couriers.openOrders', { count: c.openOrders })}
                </Text>
              </div>
              <Group gap="xs">
                {can('couriers.settle') && (
                  <Button size="xs" className="ds-grow" onClick={() => setSettling(c)}>
                    {t('couriers.settle')}
                  </Button>
                )}
                <Button size="xs" variant="default" onClick={() => setHistory(c)}>
                  {t('couriers.history')}
                </Button>
                {can('couriers.manage') && (
                  <Button size="xs" variant="subtle" onClick={() => setEditing(c)}>
                    {t('common.edit')}
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      {editing && (
        <CourierForm
          courier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {settling && <SettleDialog courier={settling} onClose={() => setSettling(null)} />}
      <Drawer
        opened={Boolean(history)}
        onClose={() => setHistory(null)}
        position="right"
        title={history?.name}
      >
        {history && <History courierId={history.id} />}
      </Drawer>
    </>
  );
}

function CourierForm({ courier, onClose }: { courier: CourierView | null; onClose: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { create, update } = useCourierActions();
  const [name, setName] = useState(courier?.name ?? '');
  const [phone, setPhone] = useState(courier?.phone ?? '');
  const [active, setActive] = useState(courier?.isActive ?? true);
  const save = async () => {
    try {
      if (courier)
        await update.mutateAsync({
          id: courier.id,
          body: { name: name.trim(), phone: phone.trim() || undefined, isActive: active },
        });
      else await create.mutateAsync({ name: name.trim(), phone: phone.trim() || undefined });
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal opened onClose={onClose} title={courier ? courier.name : t('couriers.add')} centered>
      <Stack>
        <TextInput
          label={t('couriers.name')}
          required
          data-autofocus
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label={t('customers.phone')}
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
        />
        {courier && (
          <Switch
            label={t('common.active')}
            checked={active}
            onChange={(e) => setActive(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!name.trim()}
            loading={create.isPending || update.isPending}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const neg = (v: string) => fromMinor(-toMinor(v));

function SettleDialog({ courier, onClose }: { courier: CourierView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const shiftId = useOpenShiftId();
  const { settle } = useCourierActions();
  const open = useOrders({ courierId: courier.id, status: 'OUT', unsettled: true, pageSize: 200 });
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'CASH'>('BANK_TRANSFER');
  const [received, setReceived] = useState('');
  const [fee, setFee] = useState('');
  const [reference, setReference] = useState('');
  const [key] = useState(newIdempotencyKey);
  const covered = addMoney(Number(received) || 0, Number(fee) || 0);
  // Oldest first, as the server will allocate it.
  let left = Number(covered);
  const preview = [...(open.data?.items ?? [])]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const lacking = Number(addMoney(o.cod, neg(o.settled)));
      const take = Math.max(0, Math.min(lacking, left));
      left -= take;
      return { o, lacking, take };
    });
  const blocked = method === 'CASH' && !shiftId;
  const submit = async () => {
    try {
      await settle.mutateAsync({
        courierId: courier.id,
        body: {
          idempotencyKey: key,
          method,
          received: Number(received || 0).toFixed(2),
          fee: Number(fee || 0).toFixed(2),
          reference: reference || undefined,
          shiftId: method === 'CASH' ? shiftId : undefined,
        },
      });
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={`${t('couriers.settle')} · ${courier.name}`}
      centered
      size="lg"
    >
      <Stack>
        <Text size="sm">
          {t('couriers.owes')}: <b>{money(courier.balance)}</b>
        </Text>
        <SegmentedControl
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          data={[
            { value: 'BANK_TRANSFER', label: t('sales.method.BANK_TRANSFER') },
            { value: 'CASH', label: t('sales.method.CASH') },
          ]}
        />
        <SimpleGrid cols={2}>
          <MoneyInput label={t('couriers.received')} value={received} onChange={setReceived} />
          <MoneyInput label={t('couriers.fee')} value={fee} onChange={setFee} />
        </SimpleGrid>
        {method === 'BANK_TRANSFER' && (
          <TextInput
            label={t('sales.reference')}
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        )}
        {blocked && <Alert color="red">{t('shifts.noOpenShift')}</Alert>}
        <h3 className="ds-heading">{t('couriers.covers')}</h3>
        <Stack gap={2}>
          {preview.length === 0 && (
            <Text size="sm" className="ds-muted">
              {t('couriers.noOpen')}
            </Text>
          )}
          {preview.map(({ o, lacking, take }) => (
            <Group key={o.id} justify="space-between">
              <Text size="sm" className={take > 0 ? undefined : 'ds-muted'}>
                <Link to={`/orders/${o.id}`}>
                  <span dir="ltr">{o.number}</span>
                </Link>{' '}
                · {o.customer.name}
              </Text>
              <Text size="sm" className="ds-num">
                {money(take.toFixed(2))} / {money(lacking.toFixed(2))}
              </Text>
            </Group>
          ))}
        </Stack>
        {left > 0.004 && (
          <Alert color="orange" variant="light">
            {t('couriers.overpaid', { amount: money(left.toFixed(2)) })}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!(Number(covered) > 0) || blocked}
            loading={settle.isPending}
            onClick={() => void submit()}
          >
            {t('couriers.settle')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function History({ courierId }: { courierId: string }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useSettlements(courierId);
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.length) return <EmptyState />;
  return (
    <Stack gap="sm">
      {query.data.map((s) => (
        <Card key={s.id} padding="sm">
          <Group justify="space-between">
            <Text dir="ltr" className="ds-bold">
              {s.number}
            </Text>
            <Text size="xs" className="ds-muted">
              {formatDateTime(s.createdAt, i18n.language)}
            </Text>
          </Group>
          <Text size="sm">
            {t(`sales.method.${s.method}`)} · {money(s.received)}
            {Number(s.fee) > 0 ? ` · ${t('couriers.fee')} ${money(s.fee)}` : ''}
          </Text>
          <Text size="xs" className="ds-muted">
            {s.orders.map((o) => `${o.number} ${money(o.amount)}`).join(' · ')}
          </Text>
        </Card>
      ))}
    </Stack>
  );
}
