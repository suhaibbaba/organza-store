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
import {
  IconArrowBackUp,
  IconBan,
  IconPackageExport,
  IconReceipt,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { BackLink } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError, newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDateTime } from '@web/shared/lib/format';
import {
  deviceRegister,
  useApprovalActions,
  useRegisters,
  useReturn,
  useReturnActions,
  useSale,
  useSaleActions,
} from './api';
import { ReceiptDialog } from './ReceiptDialog';
import c from './pages.module.css';
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
  const [voiding, setVoiding] = useState(false);
  const [shownReturn, setShownReturn] = useState<string | null>(null);
  const navigate = useNavigate();

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const sale = query.data;
  const held = sale.status === 'COMPLETED' && sale.fulfilment !== 'FULFILLED';
  const returnable =
    sale.status === 'COMPLETED' &&
    sale.fulfilment === 'FULFILLED' &&
    sale.lines.some((l) => l.quantity > l.returned);

  const actions = (
    <>
      {held && can('sales.handover') && (
        <Button leftSection={<IconPackageExport size={16} />} onClick={() => setHanding(true)}>
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
      {returnable && can('sales.return') && (
        <Button
          variant="light"
          leftSection={<IconArrowBackUp size={16} />}
          onClick={() => navigate(`/sales/${sale.id}/return`)}
        >
          {t('returns.returnOrExchange')}
        </Button>
      )}
      {returnable && can('sales.return') && (
        <Button
          variant="subtle"
          color="red"
          leftSection={<IconBan size={16} />}
          onClick={() => setVoiding(true)}
        >
          {t('returns.void')}
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
  );

  return (
    <>
      <BackLink to="/sales" label={t('nav.sales')} />
      <Stack gap="md">
        <Card withBorder>
          <div className={c.headTop}>
            <div className={c.headTitle}>
              <h1 className={`${c.title} o-num`}>{sale.number}</h1>
              {sale.status === 'COMPLETED' && (
                <Badge color={PAYMENT_STATE_COLORS[sale.paymentState]} variant="light">
                  {sale.paymentState === 'PAID'
                    ? t('sales.paymentState.PAID')
                    : t('sales.owedAmount', { amount: money(sale.owed) })}
                </Badge>
              )}
              {sale.status !== 'COMPLETED' && (
                <Badge color="gray">{t(`sales.status.${sale.status}`)}</Badge>
              )}
              {sale.mode === 'HELD' && (
                <Badge color="violet" variant="light">
                  {t(`sales.fulfilment.${sale.fulfilment}`)}
                </Badge>
              )}
              {sale.imported && <Badge variant="outline">{t('sales.imported')}</Badge>}
              {sale.giftReceipt && (
                <Badge color="pink" variant="light">
                  {t('sales.giftPurchase')}
                </Badge>
              )}
            </div>
            <div className={c.actions}>{actions}</div>
          </div>
          <dl className={c.fields}>
            <div className={c.field}>
              <dt className={c.fieldLabel}>{t('common.date')}</dt>
              <dd className={c.fieldValue}>{formatDateTime(sale.createdAt, i18n.language)}</dd>
            </div>
            <div className={c.field}>
              <dt className={c.fieldLabel}>{t('pos.customer')}</dt>
              <dd className={c.fieldValue}>
                {sale.customer ? (
                  <Link to={`/customers/${sale.customer.id}`} className={c.link}>
                    {sale.customer.name}
                  </Link>
                ) : (
                  <span className="ds-muted">{t('sales.walkIn')}</span>
                )}
              </dd>
            </div>
            {sale.createdBy && (
              <div className={c.field}>
                <dt className={c.fieldLabel}>{t('nav.staff')}</dt>
                <dd className={c.fieldValue}>
                  {sale.createdBy.name}
                  {sale.shift && (
                    <>
                      {' · '}
                      <Link to={`/shifts/${sale.shift.id}`} className={`${c.link} o-num`}>
                        {sale.shift.number}
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            )}
            {sale.exchangeOf && (
              <div className={c.field}>
                <dt className={c.fieldLabel}>{t('returns.exchangeOf')}</dt>
                <dd className={c.fieldValue}>
                  <Link to={`/sales/${sale.exchangeOf.saleId}`} className={`${c.link} o-num`}>
                    {sale.exchangeOf.saleNumber}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          {(sale.cancelReason || sale.note) && (
            <Stack gap={4} className="ds-mt-md">
              {sale.cancelReason && (
                <Text size="sm">
                  {t(`sales.outcome.${sale.cancelOutcome ?? 'CREDIT'}`)} · {sale.cancelReason}
                </Text>
              )}
              {sale.note && <Text size="sm">{sale.note}</Text>}
            </Stack>
          )}
        </Card>

        <div className={c.detail}>
          <div className={c.main}>
            <Card withBorder padding={0}>
              <Table.ScrollContainer minWidth={480}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('sales.item')}</Table.Th>
                      <Table.Th className="ds-center">{t('sales.quantity')}</Table.Th>
                      {sale.mode === 'HELD' && (
                        <Table.Th className="ds-center">{t('sales.handedOver')}</Table.Th>
                      )}
                      <Table.Th className="ds-end">{t('sales.total')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sale.lines.map((l) => (
                      <Table.Tr key={l.id}>
                        <Table.Td>
                          <Text size="sm" className="ds-medium">
                            {localize(l.name, i18n.language)}
                          </Text>
                          <Text size="xs" className="ds-muted">
                            {[l.variantLabel && localize(l.variantLabel, i18n.language), l.sku]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          <Group gap={4}>
                            {l.giveaway && (
                              <Badge size="xs" color="pink" variant="light">
                                {t('pos.giveaway')}
                              </Badge>
                            )}
                            {l.returned > 0 && (
                              <Badge size="xs" color="red" variant="light">
                                {t('returns.returnedCount', { count: l.returned })}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td className="ds-center ds-nowrap">
                          {l.quantity} × {money(l.unitPrice)}
                        </Table.Td>
                        {sale.mode === 'HELD' && (
                          <Table.Td className="ds-center">{l.handedOver}</Table.Td>
                        )}
                        <Table.Td className="ds-end ds-nowrap">
                          {money(l.lineTotal)}
                          {Number(l.discount) > 0 && (
                            <Text size="xs" className="ds-success">
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
              <h2 className="ds-heading ds-mb-sm">{t('sales.payments')}</h2>
              {sale.payments.length === 0 && (
                <Text size="sm" className="ds-muted">
                  {t('sales.noPayments')}
                </Text>
              )}
              <div>
                {sale.payments.map((p) => (
                  <div key={p.id} className={c.entry}>
                    <Text size="sm" className={p.reversed ? 'ds-strike' : undefined}>
                      <span className="o-num">{p.number}</span> · {t(`sales.method.${p.method}`)}
                      {p.purpose !== 'SALE' ? ` · ${t(`sales.purpose.${p.purpose}`)}` : ''} ·{' '}
                      <span className="ds-muted">{formatDateTime(p.takenAt, i18n.language)}</span>
                    </Text>
                    <div className={c.entryEnd}>
                      <Text
                        size="sm"
                        className={p.direction === 'OUT' ? 'ds-bold ds-danger' : 'ds-bold'}
                      >
                        {p.direction === 'OUT' ? '−' : ''}
                        {money(p.amountDefault)}
                      </Text>
                      {p.allocated !== null &&
                        p.allocated !== undefined &&
                        p.allocated !== p.amountDefault && (
                          <Text size="xs" className="ds-muted">
                            {t('sales.appliedHere', { amount: money(p.allocated) })}
                          </Text>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className={c.side}>
            <Card withBorder>
              <h2 className="ds-heading ds-mb-sm">{t('sales.summary')}</h2>
              <div className={c.sum}>
                {Number(sale.discountTotal) > 0 && (
                  <div className={c.sumRow}>
                    <span>{t('sales.discount')}</span>
                    <span>−{money(sale.discountTotal)}</span>
                  </div>
                )}
                <div className={`${c.sumRow} ${c.sumStrong}`}>
                  <span>{t('sales.total')}</span>
                  <span>{money(sale.total)}</span>
                </div>
                {Number(sale.returnedTotal) > 0 && (
                  <div className={c.sumRow}>
                    <span>{t('sales.returnedTotal')}</span>
                    <span className="ds-danger">−{money(sale.returnedTotal)}</span>
                  </div>
                )}
                <div className={c.sumRow}>
                  <span>{t('sales.paymentState.PAID')}</span>
                  <span>{money(sale.paid)}</span>
                </div>
                {Number(sale.change) > 0 && (
                  <div className={c.sumRow}>
                    <span>{t('sales.change')}</span>
                    <span>{money(sale.change)}</span>
                  </div>
                )}
                {Number(sale.creditKept) > 0 && (
                  <div className={c.sumRow}>
                    <span>{t('sales.creditKept')}</span>
                    <span>{money(sale.creditKept)}</span>
                  </div>
                )}
                {sale.status === 'COMPLETED' && Number(sale.owed) > 0 && (
                  <div className={`${c.sumRow} ${c.sumTotal}`}>
                    <span>{t('sales.remaining')}</span>
                    <span className="ds-danger">{money(sale.owed)}</span>
                  </div>
                )}
              </div>
            </Card>

            {sale.returns.length > 0 && (
              <Card withBorder>
                <h2 className="ds-heading ds-mb-sm">{t('returns.list')}</h2>
                <div>
                  {sale.returns.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`${c.entry} ${c.entryButton}`}
                      onClick={() => setShownReturn(r.id)}
                    >
                      <Text size="sm" className={c.entryLabel}>
                        <span className="o-num">{r.number}</span> · {t(`returns.kind.${r.kind}`)}
                        <br />
                        <span className="ds-text-xs ds-muted">
                          {formatDateTime(r.createdAt, i18n.language)}
                        </span>
                      </Text>
                      <Text size="sm" className="ds-bold ds-nowrap">
                        {money(r.value)}
                      </Text>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </Stack>

      <ReceiptDialog saleId={receipt ? sale.id : null} onClose={() => setReceipt(false)} />
      {voiding && <VoidDialog sale={sale} onClose={() => setVoiding(false)} />}
      <ReturnDialog id={shownReturn} onClose={() => setShownReturn(null)} />
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
            <Text size="sm" className="ds-grow">
              {localize(l.name, i18n.language)}
              {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
            </Text>
            <NumberInput
              className={c.qty}
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
            <Text size="sm" className="ds-bold">
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

/** Managers void at once; anyone else sends the same request to the approvals inbox. */
function VoidDialog({ sale, onClose }: { sale: SaleView; onClose: () => void }) {
  const { t } = useTranslation();
  const money = useMoney();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const registers = useRegisters();
  const { voidSale } = useReturnActions();
  const { request } = useApprovalActions();
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [reason, setReason] = useState('');
  const [key] = useState(newIdempotencyKey);
  const direct = can('sales.void');
  const paid = Number(sale.paid) > 0;
  const deviceId = deviceRegister.get();
  const shiftId =
    (registers.data ?? []).find((r) => r.id === deviceId)?.openShift?.id ??
    (registers.data ?? []).find((r) => r.openShift)?.openShift?.id;
  const body = {
    idempotencyKey: key,
    shiftId: shiftId ?? undefined,
    settlement: method === 'CREDIT' ? ('CREDIT' as const) : ('REFUND' as const),
    refundMethod: method === 'CREDIT' ? undefined : method,
    reason: reason.trim(),
  };

  const submit = async () => {
    try {
      if (direct) {
        await voidSale.mutateAsync({ saleId: sale.id, ...body });
        notifications.show({ color: 'green', message: t('returns.voided') });
      } else {
        await request.mutateAsync({
          kind: 'VOID',
          saleId: sale.id,
          reason: reason.trim(),
          request: body,
        });
        notifications.show({ color: 'green', message: t('approvals.sent') });
      }
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('returns.void')} centered>
      <Stack>
        <Text size="sm">{t('returns.voidHint')}</Text>
        {!direct && (
          <Alert color="blue" variant="light">
            {t('approvals.needsManager')}
          </Alert>
        )}
        {paid && (
          <>
            <Text size="sm" className="ds-bold">
              {t('returns.paidBack', { amount: money(sale.paid) })}
            </Text>
            <SegmentedControl
              value={method}
              onChange={(v) => setMethod(v as typeof method)}
              data={(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'] as const).map((m) => ({
                value: m,
                label: m === 'CREDIT' ? t('returns.storeCredit') : t(`sales.method.${m}`),
                disabled: m === 'CREDIT' && !sale.customer,
              }))}
            />
            {method === 'CASH' && !shiftId && (
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
            loading={voidSale.isPending || request.isPending}
            disabled={reason.trim().length < 3}
          >
            {direct ? t('returns.void') : t('approvals.ask')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ReturnDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useReturn(id);
  const r = query.data;
  return (
    <Modal opened={Boolean(id)} onClose={onClose} title={r?.number ?? ''} centered>
      {r && (
        <Stack gap="xs">
          <Text size="sm" className="ds-muted">
            {t(`returns.kind.${r.kind}`)} · {formatDateTime(r.createdAt, i18n.language)} ·{' '}
            {r.createdBy}
            {r.approvedBy ? ` · ${t('returns.approvedBy', { name: r.approvedBy })}` : ''}
          </Text>
          {r.lines.map((l) => (
            <Group key={l.id} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {l.quantity} × {localize(l.name, i18n.language)}
                {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}{' '}
                <Badge size="xs" variant="light" color={l.condition === 'DAMAGED' ? 'red' : 'teal'}>
                  {t(`returns.condition.${l.condition}`)}
                </Badge>
              </Text>
              <Text size="sm">{money(l.value)}</Text>
            </Group>
          ))}
          <Stack gap={2} className="ds-mt-xs">
            {Number(r.debtReduced) > 0 && (
              <Group justify="space-between">
                <Text size="sm">{t('returns.debtCleared')}</Text>
                <Text size="sm">{money(r.debtReduced)}</Text>
              </Group>
            )}
            {Number(r.toExchange) > 0 && r.exchangeSale && (
              <Group justify="space-between">
                <Text
                  size="sm"
                  component={Link}
                  to={`/sales/${r.exchangeSale.id}`}
                  className={c.link}
                >
                  {t('returns.toExchange', { number: r.exchangeSale.number })}
                </Text>
                <Text size="sm">{money(r.toExchange)}</Text>
              </Group>
            )}
            {Number(r.refunded) > 0 && (
              <Group justify="space-between">
                <Text size="sm">
                  {t('returns.refunded')} · {t(`sales.method.${r.refundMethod ?? 'CASH'}`)}
                </Text>
                <Text size="sm">{money(r.refunded)}</Text>
              </Group>
            )}
            {Number(r.toCredit) > 0 && (
              <Group justify="space-between">
                <Text size="sm">{t('returns.storeCredit')}</Text>
                <Text size="sm">{money(r.toCredit)}</Text>
              </Group>
            )}
          </Stack>
          <Text size="sm">{r.reason}</Text>
        </Stack>
      )}
    </Modal>
  );
}
