import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { localize, type SaleView } from '@organza/shared';
import { IconPackageExport, IconReceipt, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError } from '@web/shared/lib/api-client';
import { formatDateTime } from '@web/shared/lib/format';
import { deviceRegister, useRegisters, useSale, useSaleActions } from './api';
import { ReceiptDialog } from './ReceiptDialog';
import { PAYMENT_STATE_COLORS } from './SalesPage';

export function SaleDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const { can } = useSession();
  const query = useSale(id);
  const [receipt, setReceipt] = useState(false);
  const [handing, setHanding] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const sale = query.data;
  const held = sale.status === 'COMPLETED' && sale.fulfilment !== 'FULFILLED';

  return (
    <>
      <PageHeader
        title={sale.number}
        actions={
          <>
            {held && can('sales.handover') && (
              <Button
                leftSection={<IconPackageExport size={16} />}
                onClick={() => setHanding(true)}
              >
                {t('sales.handover')}
              </Button>
            )}
            {held && sale.fulfilment === 'HELD' && can('sales.cancelHeld') && (
              <Button
                variant="light"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => setCancelling(true)}
              >
                {t('sales.cancelHeld')}
              </Button>
            )}
            <Button
              variant="default"
              leftSection={<IconReceipt size={16} />}
              onClick={() => setReceipt(true)}
            >
              {t('sales.receipt')}
            </Button>
          </>
        }
      />
      <Stack gap="md">
        <Card withBorder>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                {formatDateTime(sale.createdAt, i18n.language)}
                {sale.createdBy ? ` · ${sale.createdBy.name}` : ''}
                {sale.shift ? ` · ${sale.shift.number}` : ''}
              </Text>
              {sale.customer ? (
                <Text component={Link} to={`/customers/${sale.customer.id}`} fw={600} c="plum.7">
                  {sale.customer.name}
                </Text>
              ) : (
                <Text c="dimmed">{t('sales.walkIn')}</Text>
              )}
              <Group gap={4}>
                {sale.status !== 'COMPLETED' && (
                  <Badge color="gray">{t(`sales.status.${sale.status}`)}</Badge>
                )}
                {sale.mode === 'HELD' && (
                  <Badge color="violet" variant="light">
                    {t(`sales.fulfilment.${sale.fulfilment}`)}
                  </Badge>
                )}
                {sale.imported && <Badge variant="outline">{t('sales.imported')}</Badge>}
              </Group>
              {sale.cancelReason && (
                <Text size="sm">
                  {t(`sales.outcome.${sale.cancelOutcome ?? 'CREDIT'}`)} · {sale.cancelReason}
                </Text>
              )}
              {sale.note && <Text size="sm">{sale.note}</Text>}
            </Stack>
            <Stack gap={2} align="flex-end">
              <Text size="xl" fw={800}>
                {money(sale.total)}
              </Text>
              {sale.status === 'COMPLETED' && (
                <Badge color={PAYMENT_STATE_COLORS[sale.paymentState]} variant="light">
                  {sale.paymentState === 'PAID'
                    ? t('sales.paymentState.PAID')
                    : t('sales.owedAmount', { amount: money(sale.owed) })}
                </Badge>
              )}
            </Stack>
          </Group>
        </Card>

        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('sales.item')}</Table.Th>
                  <Table.Th ta="center">{t('sales.quantity')}</Table.Th>
                  {sale.mode === 'HELD' && <Table.Th ta="center">{t('sales.handedOver')}</Table.Th>}
                  <Table.Th ta="end">{t('sales.total')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sale.lines.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {localize(l.name, i18n.language)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {[l.variantLabel && localize(l.variantLabel, i18n.language), l.sku]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      {l.quantity} × {money(l.unitPrice)}
                    </Table.Td>
                    {sale.mode === 'HELD' && <Table.Td ta="center">{l.handedOver}</Table.Td>}
                    <Table.Td ta="end">
                      {money(l.lineTotal)}
                      {Number(l.discount) > 0 && (
                        <Text size="xs" c="green.8">
                          −{money(l.discount)}
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        <Card withBorder>
          <Text fw={600} mb="xs">
            {t('sales.payments')}
          </Text>
          {sale.payments.length === 0 && (
            <Text size="sm" c="dimmed">
              {t('sales.noPayments')}
            </Text>
          )}
          <Stack gap={4}>
            {sale.payments.map((p) => (
              <Group key={p.id} justify="space-between">
                <Text size="sm" td={p.reversed ? 'line-through' : undefined}>
                  <span dir="ltr">{p.number}</span> · {t(`sales.method.${p.method}`)}
                  {p.purpose !== 'SALE' ? ` · ${t(`sales.purpose.${p.purpose}`)}` : ''} ·{' '}
                  {formatDateTime(p.takenAt, i18n.language)}
                </Text>
                <Text size="sm" fw={600} c={p.direction === 'OUT' ? 'red.7' : undefined}>
                  {p.direction === 'OUT' ? '−' : ''}
                  {money(p.allocated ?? p.amountDefault)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      </Stack>

      <ReceiptDialog saleId={receipt ? sale.id : null} onClose={() => setReceipt(false)} />
      {handing && <HandoverDialog sale={sale} onClose={() => setHanding(false)} />}
      {cancelling && <CancelHeldDialog sale={sale} onClose={() => setCancelling(false)} />}
    </>
  );
}

function HandoverDialog({ sale, onClose }: { sale: SaleView; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const { handover } = useSaleActions();
  const remaining = sale.lines.filter((l) => l.quantity > l.handedOver);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(remaining.map((l) => [l.id, l.quantity - l.handedOver])),
  );
  const [ack, setAck] = useState(false);
  const [needsAck, setNeedsAck] = useState(false);
  const owes = Number(sale.owed) > 0;

  const submit = async () => {
    const lines = remaining
      .filter((l) => (qty[l.id] ?? 0) > 0)
      .map((l) => ({ lineId: l.id, quantity: qty[l.id]! }));
    const everything = remaining.every((l) => qty[l.id] === l.quantity - l.handedOver);
    try {
      await handover.mutateAsync({
        id: sale.id,
        lines: everything ? undefined : lines,
        acknowledgeOwed: ack,
      });
      notifications.show({ color: 'green', message: t('sales.handedOverDone') });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OWED_NOT_ACKNOWLEDGED') setNeedsAck(true);
      else notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('sales.handover')} centered>
      <Stack>
        {remaining.map((l) => (
          <Group key={l.id} justify="space-between" wrap="nowrap">
            <Text size="sm" style={{ flex: 1 }}>
              {localize(l.name, i18n.language)}
              {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
            </Text>
            <NumberInput
              w={90}
              min={0}
              max={l.quantity - l.handedOver}
              value={qty[l.id] ?? 0}
              onChange={(v) => setQty((s) => ({ ...s, [l.id]: Number(v) || 0 }))}
              allowDecimal={false}
            />
          </Group>
        ))}
        {(owes || needsAck) && (
          <Alert color="orange" variant="light">
            <Stack gap={6}>
              <Text size="sm">{t('sales.handoverOwes', { amount: money(sale.owed) })}</Text>
              <Checkbox
                label={t('sales.acknowledgeOwed')}
                checked={ack}
                onChange={(e) => setAck(e.currentTarget.checked)}
              />
            </Stack>
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} loading={handover.isPending}>
            {t('sales.handover')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CancelHeldDialog({ sale, onClose }: { sale: SaleView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const registers = useRegisters();
  const { cancelHeld } = useSaleActions();
  const [outcome, setOutcome] = useState<'REFUND' | 'CREDIT' | 'KEEP_DEPOSIT'>('CREDIT');
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  const [reason, setReason] = useState('');
  const paid = Number(sale.paid) > 0;
  const deviceId = deviceRegister.get();
  const shiftId =
    (registers.data ?? []).find((r) => r.id === deviceId)?.openShift?.id ??
    (registers.data ?? []).find((r) => r.openShift)?.openShift?.id;

  const submit = async () => {
    try {
      await cancelHeld.mutateAsync({
        id: sale.id,
        outcome: paid ? outcome : 'CREDIT',
        refundMethod: outcome === 'REFUND' ? method : undefined,
        shiftId: outcome === 'REFUND' && method === 'CASH' ? shiftId : undefined,
        reason: reason.trim(),
      });
      notifications.show({ color: 'green', message: t('sales.cancelledDone') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('sales.cancelHeld')} centered>
      <Stack>
        <Text size="sm">{t('sales.cancelHeldHint')}</Text>
        {paid && (
          <>
            <Text size="sm" fw={600}>
              {t('sales.depositPaid', { amount: money(sale.paid) })}
            </Text>
            <SegmentedControl
              value={outcome}
              onChange={(v) => setOutcome(v as typeof outcome)}
              data={[
                { value: 'CREDIT', label: t('sales.outcome.CREDIT') },
                { value: 'REFUND', label: t('sales.outcome.REFUND') },
                {
                  value: 'KEEP_DEPOSIT',
                  label: t('sales.outcome.KEEP_DEPOSIT'),
                  disabled: !can('sales.keepDeposit'),
                },
              ]}
            />
            {outcome === 'REFUND' && (
              <SegmentedControl
                value={method}
                onChange={(v) => setMethod(v as typeof method)}
                data={(['CASH', 'CARD', 'BANK_TRANSFER'] as const).map((m) => ({
                  value: m,
                  label: t(`sales.method.${m}`),
                }))}
              />
            )}
            {outcome === 'REFUND' && method === 'CASH' && !shiftId && (
              <Alert color="orange" variant="light">
                {t('errors.SHIFT_REQUIRED')}
              </Alert>
            )}
          </>
        )}
        <Textarea
          label={t('sales.reason')}
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
            onClick={() => void submit()}
            loading={cancelHeld.isPending}
            disabled={!reason.trim()}
          >
            {t('sales.cancelHeld')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
