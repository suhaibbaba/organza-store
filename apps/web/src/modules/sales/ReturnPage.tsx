import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  addMoney,
  type CreateReturnInput,
  fromMinor,
  localize,
  multiplyMoney,
  type ReturnCondition,
  type SaleLineView,
  toMinor,
} from '@organza/shared';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import type { CartLine } from '@web/modules/pos/cart';
import { useItemChooser } from '@web/modules/pos/picking';
import { ProductBrowser } from '@web/modules/pos/ProductBrowser';
import { useDefaultCurrency } from '@web/modules/settings/api';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError, newIdempotencyKey } from '@web/shared/lib/api-client';
import { deviceRegister, useApprovalActions, useRegisters, useReturnActions, useSale } from './api';
import c from './pages.module.css';

type Refund = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT';
type Tender = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'DEBT';
type NewLine = Omit<CartLine, 'key' | 'discount'>;

/** The value of `quantity` more pieces of a line; the same rounding as the server. */
function partValue(line: SaleLineView, quantity: number): string {
  const upTo = (n: number) => Math.round((toMinor(line.lineTotal) * n) / line.quantity);
  return fromMinor(upTo(line.returned + quantity) - upTo(line.returned));
}

/**
 * Returns and exchanges (proposal user flow "Returns and exchanges"): tick what comes back and
 * its condition, optionally pick new goods, then settle the difference in the same screen.
 */
export function ReturnPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const navigate = useNavigate();
  const currency = useDefaultCurrency();
  const errorMessage = useErrorMessage();
  const { can } = useSession();
  const query = useSale(id);
  const registers = useRegisters();
  const { create } = useReturnActions();
  const { request } = useApprovalActions();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [condition, setCondition] = useState<Record<string, ReturnCondition>>({});
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [refund, setRefund] = useState<Refund | null>(null);
  const [tender, setTender] = useState<Tender>('CASH');
  const [reason, setReason] = useState('');
  const [key] = useState(newIdempotencyKey);
  const [needsManager, setNeedsManager] = useState(false);

  const chooser = useItemChooser((line) => {
    setNewLines((lines) => {
      const found = lines.find((l) => l.itemId === line.itemId);
      if (found) return lines.map((l) => (l === found ? { ...l, quantity: l.quantity + 1 } : l));
      return [...lines, { ...line, quantity: 1 }];
    });
    setBrowsing(false);
  });

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const sale = query.data;
  const returnable = sale.lines.filter((l) => l.quantity - l.returned > 0);
  const deviceId = deviceRegister.get();
  const shiftId =
    (registers.data ?? []).find((r) => r.id === deviceId)?.openShift?.id ??
    (registers.data ?? []).find((r) => r.openShift)?.openShift?.id;

  if (sale.status !== 'COMPLETED' || sale.fulfilment !== 'FULFILLED' || !returnable.length)
    return (
      <>
        <PageHeader
          title={t('returns.title', { number: sale.number })}
          back={{ to: `/sales/${sale.id}`, label: sale.number }}
        />
        <Alert color="orange">{t('errors.SALE_NOT_RETURNABLE')}</Alert>
      </>
    );

  // The same order of settlement as the server: debt first, then the new goods, then the rest.
  const value = addMoney('0', ...returnable.map((l) => partValue(l, qty[l.id] ?? 0)));
  const debtCleared = Math.min(Number(value), Math.max(Number(sale.owed), 0)).toFixed(2);
  const paidBack = addMoney(value, `-${debtCleared}`);
  const newTotal = addMoney('0', ...newLines.map((l) => multiplyMoney(l.unitPrice, l.quantity)));
  const toExchange = Math.min(Number(paidBack), Number(newTotal)).toFixed(2);
  const rest = addMoney(paidBack, `-${toExchange}`);
  const due = addMoney(newTotal, `-${toExchange}`);
  const picked = returnable.filter((l) => (qty[l.id] ?? 0) > 0);
  const exchange = newLines.length > 0;
  const refundMethod: Refund = refund ?? 'CASH';
  const needsShift = (Number(rest) > 0 && refundMethod === 'CASH') || exchange;
  const blocked =
    !picked.length ||
    reason.trim().length < 3 ||
    (needsShift && !shiftId) ||
    (Number(rest) > 0 && refundMethod === 'CREDIT' && !sale.customer) ||
    (Number(due) > 0 && tender === 'DEBT' && !sale.customer);

  const body = (): CreateReturnInput => ({
    idempotencyKey: key,
    saleId: sale.id,
    shiftId: shiftId ?? undefined,
    reason: reason.trim(),
    settlement: refundMethod === 'CREDIT' ? 'CREDIT' : 'REFUND',
    refundMethod: refundMethod === 'CREDIT' || refund === null ? undefined : refundMethod,
    lines: picked.map((l) => ({
      lineId: l.id,
      quantity: qty[l.id]!,
      condition: condition[l.id] ?? 'SHELF',
    })),
    exchange: exchange
      ? {
          lines: newLines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          payments:
            Number(due) > 0 && tender !== 'DEBT' ? [{ method: tender, currency, amount: due }] : [],
        }
      : undefined,
  });

  const submit = async () => {
    try {
      const r = await create.mutateAsync(body());
      notifications.show({ color: 'green', message: t('returns.done', { number: r.number }) });
      navigate(`/sales/${r.exchangeSale?.id ?? sale.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REFUND_NEEDS_MANAGER') setNeedsManager(true);
      else notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  const askManager = async () => {
    try {
      await request.mutateAsync({ kind: 'REFUND', reason: reason.trim(), request: body() });
      notifications.show({ color: 'green', message: t('approvals.sent') });
      navigate(`/sales/${sale.id}`);
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <>
      <PageHeader
        title={t('returns.title', { number: sale.number })}
        back={{ to: `/sales/${sale.id}`, label: sale.number }}
      />
      <Stack gap="md" className="ds-w-xl">
        <div className={c.pair}>
          <Card withBorder>
            <h2 className="ds-heading ds-mb-sm">{t('returns.whatComesBack')}</h2>
            <Stack gap="sm">
              {returnable.map((l) => {
                const left = l.quantity - l.returned;
                const n = qty[l.id] ?? 0;
                return (
                  <Stack key={l.id} gap={6}>
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Stack gap={0} className="ds-min-0">
                        <Text size="sm" className="ds-medium" truncate>
                          {localize(l.name, i18n.language)}
                          {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
                        </Text>
                        <Text size="xs" className="ds-muted">
                          {t('returns.leftToReturn', { count: left })} · {money(partValue(l, 1))}
                          {l.giveaway ? ` · ${t('pos.giveaway')}` : ''}
                        </Text>
                      </Stack>
                      <NumberInput
                        className={c.qty}
                        min={0}
                        max={left}
                        value={n}
                        aria-label={t('sales.quantity')}
                        onChange={(v) =>
                          setQty((q) => ({
                            ...q,
                            [l.id]: Math.min(left, Math.max(0, Number(v) || 0)),
                          }))
                        }
                      />
                    </Group>
                    {n > 0 && (
                      <SegmentedControl
                        size="xs"
                        value={condition[l.id] ?? 'SHELF'}
                        onChange={(v) =>
                          setCondition((c) => ({ ...c, [l.id]: v as ReturnCondition }))
                        }
                        data={[
                          { value: 'SHELF', label: t('returns.condition.SHELF') },
                          { value: 'DAMAGED', label: t('returns.condition.DAMAGED') },
                        ]}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Card>

          <Card withBorder>
            <Group justify="space-between" className={newLines.length ? 'ds-mb-sm' : undefined}>
              <h2 className="ds-heading">{t('returns.exchangeFor')}</h2>
              {can('sales.create') && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setBrowsing(true)}
                >
                  {t('returns.addItems')}
                </Button>
              )}
            </Group>
            <Stack gap={6}>
              {newLines.map((l) => (
                <Group key={l.itemId} justify="space-between" wrap="nowrap">
                  <Text size="sm" truncate className="ds-min-0">
                    {localize(l.name, i18n.language)}
                    {l.variantLabel ? ` · ${l.variantLabel}` : ''}
                  </Text>
                  <Group gap={6} wrap="nowrap">
                    <NumberInput
                      className={c.qtySm}
                      min={1}
                      max={Math.max(1, l.available)}
                      value={l.quantity}
                      aria-label={t('sales.quantity')}
                      onChange={(v) =>
                        setNewLines((ls) =>
                          ls.map((x) =>
                            x === l ? { ...x, quantity: Math.max(1, Number(v) || 1) } : x,
                          ),
                        )
                      }
                    />
                    <Text size="sm" className={`${c.amount} ds-end ds-nowrap`}>
                      {money(multiplyMoney(l.unitPrice, l.quantity))}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t('common.remove')}
                      onClick={() => setNewLines((ls) => ls.filter((x) => x !== l))}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        </div>

        <Card withBorder>
          <Stack gap={6}>
            <Row label={t('returns.value')} amount={money(value)} strong />
            {Number(debtCleared) > 0 && (
              <Row label={t('returns.debtCleared')} amount={money(debtCleared)} />
            )}
            {exchange && <Row label={t('returns.newGoods')} amount={money(newTotal)} />}
            {exchange && Number(due) > 0 && (
              <>
                <Row label={t('returns.customerPays')} amount={money(due)} strong />
                <SegmentedControl
                  value={tender}
                  onChange={(v) => setTender(v as Tender)}
                  data={(['CASH', 'CARD', 'BANK_TRANSFER', 'DEBT'] as const).map((m) => ({
                    value: m,
                    label: m === 'DEBT' ? t('returns.addToDebt') : t(`sales.method.${m}`),
                    disabled: m === 'DEBT' && !sale.customer,
                  }))}
                />
              </>
            )}
            {Number(rest) > 0 && (
              <>
                <Row label={t('returns.backToCustomer')} amount={money(rest)} strong />
                <SegmentedControl
                  value={refundMethod}
                  onChange={(v) => setRefund(v as Refund)}
                  data={(['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'] as const).map((m) => ({
                    value: m,
                    label: m === 'CREDIT' ? t('returns.storeCredit') : t(`sales.method.${m}`),
                    disabled: m === 'CREDIT' && !sale.customer,
                  }))}
                />
                {refund === null && (
                  <Text size="xs" className="ds-muted">
                    {t('returns.defaultMethodHint')}
                  </Text>
                )}
              </>
            )}
            {needsShift && !shiftId && (
              <Alert color="orange" variant="light">
                {t('errors.SHIFT_REQUIRED')}
              </Alert>
            )}
          </Stack>
        </Card>

        <Textarea
          label={t('sales.reason')}
          required
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        {needsManager && (
          <Alert color="orange" title={t('errors.REFUND_NEEDS_MANAGER')}>
            <Stack gap="xs">
              <Text size="sm">{t('approvals.askHint')}</Text>
              <Group>
                <Button onClick={() => void askManager()} loading={request.isPending}>
                  {t('approvals.ask')}
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate(`/sales/${sale.id}`)}>
            {t('common.back')}
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending} disabled={blocked}>
            {exchange ? t('returns.completeExchange') : t('returns.complete')}
          </Button>
        </Group>
        {picked.length > 0 && (
          <Group gap={4}>
            {picked.map((l) => (
              <Badge
                key={l.id}
                variant="light"
                color={condition[l.id] === 'DAMAGED' ? 'red' : 'teal'}
              >
                {qty[l.id]} × {localize(l.name, i18n.language)}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>

      <Drawer
        opened={browsing}
        onClose={() => setBrowsing(false)}
        position="bottom"
        size="85%"
        title={t('returns.addItems')}
      >
        <ProductBrowser
          onProduct={(pid) => void chooser.pickProduct(pid)}
          onCode={chooser.pickCode}
        />
      </Drawer>
      {chooser.picker}
    </>
  );
}

function Row({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={strong ? `${c.sumRow} ${c.sumStrong}` : c.sumRow}>
      <span>{label}</span>
      <span>{amount}</span>
    </div>
  );
}
