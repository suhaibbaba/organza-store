import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SUPPLIER_PAYMENT_METHODS, type SupplierPaymentMethod } from '@organza/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useOpenShiftId } from '@web/modules/orders/api';
import { useDefaultCurrency } from '@web/modules/settings/api';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { PageHeader } from '@web/shared/components/PageHeader';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { usePurchaseOrder, usePurchaseOrders, usePurchasingActions, useSuppliers } from './api';
import { type CostLine, isCost, lineValue, PurchaseLinesEditor } from './PurchaseLinesEditor';

/**
 * Receiving goods (workflow D "Inventory receiving") or writing a purchase order: the same
 * form, a supplier and lines with costs. Receiving can start from an open purchase order.
 */
export function PurchaseFormPage({ mode }: { mode: 'receive' | 'order' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const money = useMoney();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const currency = useDefaultCurrency();
  const shiftId = useOpenShiftId();
  const [params] = useSearchParams();
  const actions = usePurchasingActions();
  const suppliers = useSuppliers({ active: true });
  const [supplierId, setSupplierId] = useState<string | null>(params.get('supplierId'));
  const [orderId, setOrderId] = useState<string | null>(params.get('orderId'));
  const openOrders = usePurchaseOrders({ supplierId: supplierId ?? undefined, open: true });
  const order = usePurchaseOrder(mode === 'receive' ? orderId : null);
  const [lines, setLines] = useState<CostLine[]>([]);
  const [extraCosts, setExtraCosts] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [note, setNote] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [method, setMethod] = useState<SupplierPaymentMethod>('CASH');
  const [paid, setPaid] = useState('');
  const [key] = useState(newIdempotencyKey);

  // Receiving against an order: what is still open, at the ordered cost.
  useEffect(() => {
    if (!order.data) return;
    setSupplierId(order.data.supplier.id);
    setLines(
      order.data.lines
        .filter((l) => l.open > 0)
        .map((l) => ({
          key: l.id,
          itemId: l.itemId,
          name: l.name,
          variantLabel: l.variantLabel,
          sku: l.sku,
          quantity: l.open,
          unitCost: l.unitCost,
          open: l.open,
        })),
    );
  }, [order.data]);

  const subtotal = lines.reduce((s, l) => s + lineValue(l), 0);
  const total = subtotal + (Number(extraCosts) || 0);
  const valid = Boolean(supplierId) && lines.length > 0 && lines.every((l) => isCost(l.unitCost));
  const paying = mode === 'receive' && payNow && Number(paid) > 0;
  const blocked = paying && method === 'CASH' && !shiftId;

  const submit = async () => {
    if (!supplierId) return;
    const body = lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitCost: l.unitCost,
    }));
    try {
      if (mode === 'order') {
        const po = await actions.createOrder.mutateAsync({
          idempotencyKey: key,
          supplierId,
          expectedAt: expectedAt || undefined,
          note: note || undefined,
          lines: body,
        });
        notifications.show({ color: 'green', message: t('common.saved') });
        navigate(`/purchasing/orders/${po.id}`, { replace: true });
      } else {
        const r = await actions.receive.mutateAsync({
          idempotencyKey: key,
          supplierId,
          purchaseOrderId: orderId ?? undefined,
          supplierRef: supplierRef || undefined,
          note: note || undefined,
          lines: body,
          extraCosts: (Number(extraCosts) || 0).toFixed(2),
          payment: paying
            ? { method, currency: currency ?? 'ILS', amount: Number(paid).toFixed(2) }
            : undefined,
          shiftId: paying && method === 'CASH' ? shiftId : undefined,
        });
        notifications.show({ color: 'green', message: t('purchasing.received') });
        navigate(`/purchasing/receipts/${r.id}?fresh=1`, { replace: true });
      }
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <>
      <PageHeader title={mode === 'order' ? t('purchasing.newOrder') : t('purchasing.receive')} />
      <Stack gap="md" maw={960}>
        <Card withBorder>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label={t('purchasing.supplier')}
              required
              searchable
              disabled={Boolean(order.data)}
              value={supplierId}
              onChange={(v) => {
                setSupplierId(v);
                setOrderId(null);
              }}
              data={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            />
            {mode === 'receive' ? (
              <Select
                label={t('purchasing.againstOrder')}
                placeholder={t('purchasing.noOrder')}
                clearable
                disabled={!supplierId}
                value={orderId}
                onChange={(v) => {
                  setOrderId(v);
                  if (!v) setLines([]);
                }}
                data={(openOrders.data?.items ?? []).map((o) => ({
                  value: o.id,
                  label: `${o.number} · ${o.received}/${o.ordered}`,
                }))}
              />
            ) : (
              <TextInput
                type="date"
                label={t('purchasing.expected')}
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.currentTarget.value)}
              />
            )}
            {mode === 'receive' && (
              <TextInput
                label={t('purchasing.supplierRef')}
                value={supplierRef}
                onChange={(e) => setSupplierRef(e.currentTarget.value)}
              />
            )}
            <Textarea
              label={t('common.note')}
              autosize
              minRows={1}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
            />
          </SimpleGrid>
        </Card>
        <Card withBorder>
          <Text fw={600} mb="xs">
            {t('orders.lines')}
          </Text>
          <PurchaseLinesEditor lines={lines} onChange={setLines} />
        </Card>
        {mode === 'receive' && (
          <Card withBorder>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <MoneyInput
                label={t('purchasing.extraCosts')}
                description={t('purchasing.extraCostsHint')}
                value={extraCosts}
                onChange={setExtraCosts}
              />
              {can('suppliers.pay') && (
                <Stack gap="xs">
                  <Switch
                    label={t('purchasing.payNow')}
                    checked={payNow}
                    onChange={(e) => {
                      setPayNow(e.currentTarget.checked);
                      if (!paid) setPaid(total.toFixed(2));
                    }}
                  />
                  {payNow && (
                    <Group grow>
                      <Select
                        allowDeselect={false}
                        value={method}
                        onChange={(v) => setMethod((v as SupplierPaymentMethod) ?? 'CASH')}
                        data={SUPPLIER_PAYMENT_METHODS.map((m) => ({
                          value: m,
                          label: t(`sales.method.${m}`),
                        }))}
                      />
                      <MoneyInput value={paid} onChange={setPaid} />
                    </Group>
                  )}
                  {blocked && <Alert color="red">{t('shifts.noOpenShift')}</Alert>}
                </Stack>
              )}
            </SimpleGrid>
          </Card>
        )}
        <Group justify="space-between">
          <Stack gap={0}>
            <Text fw={700} size="lg">
              {money(total.toFixed(2))}
            </Text>
            {mode === 'receive' && (
              <Text size="xs" c="dimmed">
                {t('purchasing.owedAfter', {
                  amount: money(Math.max(0, total - (paying ? Number(paid) : 0)).toFixed(2)),
                })}
              </Text>
            )}
          </Stack>
          <Group>
            <Button variant="default" onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
            <Button
              disabled={!valid || blocked}
              loading={actions.receive.isPending || actions.createOrder.isPending}
              onClick={() => void submit()}
            >
              {mode === 'order' ? t('common.save') : t('purchasing.receiveGoods')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </>
  );
}
