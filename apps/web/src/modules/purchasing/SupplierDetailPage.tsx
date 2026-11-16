import { BackLink } from '@web/shared/components/PageHeader';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  localize,
  SUPPLIER_PAYMENT_METHODS,
  type SupplierPaymentMethod,
  type SupplierView,
} from '@organza/shared';
import { IconDots, IconPackageImport } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useOpenShiftId } from '@web/modules/orders/api';
import { useDefaultCurrency } from '@web/modules/settings/api';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { EmptyState, ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { newIdempotencyKey } from '@web/shared/lib/api-client';
import { formatDate, formatDateTime } from '@web/shared/lib/format';
import {
  useCreditNotes,
  usePurchaseOrders,
  usePurchasingActions,
  useReceipt,
  useReceipts,
  useStatement,
  useSupplier,
  useSupplierPayments,
} from './api';
import { type CostLine, isCost, lineValue, PurchaseLinesEditor } from './PurchaseLinesEditor';
import { SupplierForm } from './SuppliersPage';
import classes from './purchasing.module.css';

/** One supplier: balance, statement, receipts, orders, payments and credit notes. */
export function SupplierDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const money = useMoney();
  const query = useSupplier(id);
  const [dialog, setDialog] = useState<'pay' | 'credit' | 'edit' | null>(null);

  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const s = query.data;
  const owed = Number(s.owed);

  return (
    <>
      <BackLink to="/suppliers" label={t('nav.suppliers')} />
      <Group justify="space-between" wrap="wrap" gap="xs" className={classes.head}>
        <Group gap="xs">
          <h1 className={classes.title}>{s.name}</h1>
          {!s.isActive && <Badge color="gray">{t('common.inactive')}</Badge>}
        </Group>
        <Group gap="xs">
          {can('purchasing.receive') && (
            <Button
              leftSection={<IconPackageImport size={16} />}
              onClick={() => navigate(`/purchasing/receive?supplierId=${s.id}`)}
            >
              {t('purchasing.receive')}
            </Button>
          )}
          {can('suppliers.pay') && (
            <Button variant="light" onClick={() => setDialog('pay')}>
              {t('suppliers.pay')}
            </Button>
          )}
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label={t('common.more')}>
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {can('purchasing.order') && (
                <Menu.Item onClick={() => navigate(`/purchasing/orders/new?supplierId=${s.id}`)}>
                  {t('purchasing.newOrder')}
                </Menu.Item>
              )}
              {can('purchasing.credit') && (
                <Menu.Item onClick={() => setDialog('credit')}>
                  {t('purchasing.creditNote')}
                </Menu.Item>
              )}
              {can('suppliers.manage') && (
                <Menu.Item onClick={() => setDialog('edit')}>{t('common.edit')}</Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <div className={classes.grid}>
        <div className={classes.main}>
          <Tabs defaultValue="statement" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="statement">{t('suppliers.statement')}</Tabs.Tab>
              <Tabs.Tab value="receipts">{t('purchasing.receipts')}</Tabs.Tab>
              <Tabs.Tab value="orders">{t('purchasing.orders')}</Tabs.Tab>
              <Tabs.Tab value="payments">{t('suppliers.payments')}</Tabs.Tab>
              <Tabs.Tab value="credits">{t('purchasing.creditNotes')}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="statement">
              <Statement supplierId={s.id} />
            </Tabs.Panel>
            <Tabs.Panel value="receipts">
              <ReceiptsTable supplierId={s.id} />
            </Tabs.Panel>
            <Tabs.Panel value="orders">
              <OrdersTable supplierId={s.id} />
            </Tabs.Panel>
            <Tabs.Panel value="payments">
              <Payments supplierId={s.id} />
            </Tabs.Panel>
            <Tabs.Panel value="credits">
              <CreditNotes supplierId={s.id} />
            </Tabs.Panel>
          </Tabs>
        </div>
        <div className={classes.side}>
          <Card>
            <span className="ds-eyebrow">
              {owed < 0 ? t('suppliers.paidAhead') : t('suppliers.owed')}
            </span>
            <div className={owed > 0 ? 'ds-figure ds-warning' : 'ds-figure'}>
              {money(Math.abs(owed).toFixed(2))}
            </div>
            <Text size="xs" className="ds-muted">
              {t('suppliers.openCounts', { receipts: s.openReceipts, orders: s.openOrders })}
            </Text>
          </Card>
          {(s.contactName || s.phone || s.address) && (
            <Card>
              <Stack gap="sm">
                {s.contactName && (
                  <div>
                    <div className="ds-eyebrow">{t('suppliers.contact')}</div>
                    <Text size="sm">{s.contactName}</Text>
                  </div>
                )}
                {s.phone && (
                  <div>
                    <div className="ds-eyebrow">{t('customers.phone')}</div>
                    <Text size="sm" className="ds-ltr">
                      {s.phone}
                    </Text>
                  </div>
                )}
                {s.address && (
                  <div>
                    <div className="ds-eyebrow">{t('orders.address')}</div>
                    <Text size="sm">{s.address}</Text>
                  </div>
                )}
              </Stack>
            </Card>
          )}
        </div>
      </div>

      {dialog === 'pay' && <PayDialog supplier={s} onClose={() => setDialog(null)} />}
      {dialog === 'credit' && <CreditNoteDialog supplier={s} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <SupplierForm supplier={s} onClose={() => setDialog(null)} />}
    </>
  );
}

const DOC_LINK: Record<string, (id: string) => string | null> = {
  RECEIPT: (id) => `/purchasing/receipts/${id}`,
  CREDIT_NOTE: () => null,
  PAYMENT: () => null,
  REFUND: () => null,
  OPENING: () => null,
};

function Statement({ supplierId }: { supplierId: string }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useStatement(supplierId);
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.length) return <EmptyState />;
  return (
    <Card padding={0}>
      <Table.ScrollContainer minWidth={560}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.date')}</Table.Th>
              <Table.Th>{t('suppliers.document')}</Table.Th>
              <Table.Th className="ds-end">{t('suppliers.debit')}</Table.Th>
              <Table.Th className="ds-end">{t('suppliers.credit')}</Table.Th>
              <Table.Th className="ds-end">{t('suppliers.balance')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...query.data].reverse().map((r) => {
              const link = DOC_LINK[r.kind]?.(r.documentId);
              return (
                <Table.Tr key={`${r.kind}-${r.documentId}`}>
                  <Table.Td>{formatDate(r.date, i18n.language)}</Table.Td>
                  <Table.Td>
                    {t(`suppliers.kind.${r.kind}`)}{' '}
                    {link ? (
                      <Anchor component={Link} to={link} size="sm" dir="ltr">
                        {r.number}
                      </Anchor>
                    ) : (
                      <span dir="ltr">{r.number}</span>
                    )}
                  </Table.Td>
                  <Table.Td className="ds-end">{Number(r.debit) ? money(r.debit) : ''}</Table.Td>
                  <Table.Td className="ds-end">{Number(r.credit) ? money(r.credit) : ''}</Table.Td>
                  <Table.Td className="ds-end ds-bold">{money(r.balance)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

export function ReceiptsTable({ supplierId, open }: { supplierId?: string; open?: boolean }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useReceipts({ supplierId, open, pageSize: 100 });
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.items.length) return <EmptyState />;
  return (
    <Card padding={0}>
      <Table.ScrollContainer minWidth={560}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('purchasing.receipt')}</Table.Th>
              {!supplierId && <Table.Th>{t('purchasing.supplier')}</Table.Th>}
              <Table.Th>{t('common.date')}</Table.Th>
              <Table.Th className="ds-end">{t('sales.total')}</Table.Th>
              <Table.Th className="ds-end">{t('purchasing.open')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {query.data.items.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Anchor component={Link} to={`/purchasing/receipts/${r.id}`} dir="ltr">
                    {r.number}
                  </Anchor>
                  {r.supplierRef && (
                    <Text span size="xs" className="ds-muted">
                      {' '}
                      ({r.supplierRef})
                    </Text>
                  )}
                </Table.Td>
                {!supplierId && <Table.Td>{r.supplier.name}</Table.Td>}
                <Table.Td>{formatDate(r.createdAt, i18n.language)}</Table.Td>
                <Table.Td className="ds-end">{money(r.total)}</Table.Td>
                <Table.Td
                  className={Number(r.open) > 0 ? 'ds-end ds-warning' : 'ds-end ds-success'}
                >
                  {Number(r.open) > 0 ? money(r.open) : t('sales.paymentState.PAID')}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

export function OrdersTable({ supplierId, open }: { supplierId?: string; open?: boolean }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = usePurchaseOrders({ supplierId, open, pageSize: 100 });
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.items.length) return <EmptyState />;
  return (
    <Card padding={0}>
      <Table.ScrollContainer minWidth={560}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('purchasing.order')}</Table.Th>
              {!supplierId && <Table.Th>{t('purchasing.supplier')}</Table.Th>}
              <Table.Th>{t('purchasing.expected')}</Table.Th>
              <Table.Th>{t('purchasing.arrived')}</Table.Th>
              <Table.Th className="ds-end">{t('sales.total')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {query.data.items.map((o) => (
              <Table.Tr key={o.id}>
                <Table.Td>
                  <Anchor component={Link} to={`/purchasing/orders/${o.id}`} dir="ltr">
                    {o.number}
                  </Anchor>{' '}
                  <Badge size="xs" color={PO_COLORS[o.status]}>
                    {t(`purchasing.status.${o.status}`)}
                  </Badge>
                </Table.Td>
                {!supplierId && <Table.Td>{o.supplier.name}</Table.Td>}
                <Table.Td>{o.expectedAt ? formatDate(o.expectedAt, i18n.language) : '—'}</Table.Td>
                <Table.Td>
                  {o.received} / {o.ordered}
                </Table.Td>
                <Table.Td className="ds-end">{money(o.total)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

export const PO_COLORS = { OPEN: 'blue', CLOSED: 'green', CANCELLED: 'gray' } as const;

function Payments({ supplierId }: { supplierId: string }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useSupplierPayments(supplierId);
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.length) return <EmptyState />;
  return (
    <Stack gap="xs" className="o-list">
      {query.data.map((p) => (
        <Card key={p.id} padding="sm">
          <Group justify="space-between">
            <Text className="ds-bold">
              <span dir="ltr">{p.number}</span> ·{' '}
              {p.direction === 'IN' ? t('suppliers.kind.REFUND') : t('suppliers.kind.PAYMENT')} ·{' '}
              {t(`sales.method.${p.method}`)}
            </Text>
            <Text className="ds-bold">
              {p.currency !== 'ILS' ? `${p.amount} ${p.currency} · ` : ''}
              {money(p.amountDefault)}
            </Text>
          </Group>
          <Text size="xs" className="ds-muted">
            {formatDateTime(p.takenAt, i18n.language)} · {p.takenBy}
            {p.reference ? ` · ${p.reference}` : ''}
          </Text>
          {p.allocations.length > 0 && (
            <Text size="xs">
              {p.allocations.map((a) => `${a.number} ${money(a.amount)}`).join(' · ')}
            </Text>
          )}
        </Card>
      ))}
    </Stack>
  );
}

function CreditNotes({ supplierId }: { supplierId: string }) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const query = useCreditNotes(supplierId);
  if (query.isPending) return <FullScreenLoader />;
  if (!query.data?.length) return <EmptyState />;
  return (
    <Stack gap="xs" className="o-list">
      {query.data.map((c) => (
        <Card key={c.id} padding="sm">
          <Group justify="space-between">
            <Text className="ds-bold">
              <span dir="ltr">{c.number}</span> · {t(`purchasing.creditKind.${c.kind}`)}
              {c.receipt ? (
                <>
                  {' · '}
                  <Anchor component={Link} to={`/purchasing/receipts/${c.receipt.id}`} dir="ltr">
                    {c.receipt.number}
                  </Anchor>
                </>
              ) : null}
            </Text>
            <Text className="ds-bold">{money(c.amount)}</Text>
          </Group>
          <Text size="xs" className="ds-muted">
            {formatDateTime(c.createdAt, i18n.language)} · {c.createdBy} · {c.reason}
          </Text>
          {c.lines.length > 0 && (
            <Text size="xs">
              {c.lines.map((l) => `${localize(l.name, i18n.language)} × ${l.quantity}`).join(' · ')}
            </Text>
          )}
        </Card>
      ))}
    </Stack>
  );
}

// ------------------------------------------------------------------ dialogs

export function PayDialog({
  supplier,
  onClose,
  receiptId,
}: {
  supplier: SupplierView;
  onClose: () => void;
  receiptId?: string;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const currency = useDefaultCurrency();
  const shiftId = useOpenShiftId();
  const { pay } = usePurchasingActions();
  const open = useReceipts({ supplierId: supplier.id, open: true, pageSize: 200 });
  const [direction, setDirection] = useState<'OUT' | 'IN'>('OUT');
  const [method, setMethod] = useState<SupplierPaymentMethod>('BANK_TRANSFER');
  const [amount, setAmount] = useState(
    receiptId
      ? (open.data?.items.find((r) => r.id === receiptId)?.open ?? '')
      : Number(supplier.owed) > 0
        ? supplier.owed
        : '',
  );
  const [reference, setReference] = useState('');
  const [key] = useState(newIdempotencyKey);
  const blocked = method === 'CASH' && !shiftId;
  // The receipt being paid fills the amount once the open receipts have loaded.
  const due = open.data?.items.find((r) => r.id === receiptId)?.open;
  useEffect(() => {
    if (due) setAmount((current) => current || due);
  }, [due]);

  let left = Number(amount) || 0;
  const preview = [...(open.data?.items ?? [])]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .sort((a, b) => (a.id === receiptId ? -1 : b.id === receiptId ? 1 : 0))
    .map((r) => {
      const take = Math.max(0, Math.min(Number(r.open), left));
      left = Math.round((left - take) * 100) / 100;
      return { r, take };
    });

  const submit = async () => {
    try {
      await pay.mutateAsync({
        supplierId: supplier.id,
        body: {
          idempotencyKey: key,
          direction,
          payment: {
            method,
            currency: currency ?? 'ILS',
            amount: Number(amount).toFixed(2),
            reference: reference || undefined,
          },
          shiftId: method === 'CASH' ? shiftId : undefined,
          allocations:
            direction === 'OUT' && receiptId
              ? preview
                  .filter((p) => p.take > 0)
                  .map((p) => ({ receiptId: p.r.id, amount: p.take.toFixed(2) }))
              : undefined,
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
      title={`${t('suppliers.pay')} · ${supplier.name}`}
      centered
      size="lg"
    >
      <Stack>
        <SegmentedControl
          value={direction}
          onChange={(v) => setDirection(v as typeof direction)}
          data={[
            { value: 'OUT', label: t('suppliers.payOut') },
            { value: 'IN', label: t('suppliers.refundIn') },
          ]}
        />
        <Select
          label={t('suppliers.method')}
          allowDeselect={false}
          value={method}
          onChange={(v) => setMethod((v as SupplierPaymentMethod) ?? 'BANK_TRANSFER')}
          data={SUPPLIER_PAYMENT_METHODS.map((m) => ({ value: m, label: t(`sales.method.${m}`) }))}
        />
        <SimpleGrid cols={2}>
          <MoneyInput label={t('sales.amount')} required value={amount} onChange={setAmount} />
          <TextInput
            label={t('sales.reference')}
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        </SimpleGrid>
        {blocked && <Alert color="red">{t('shifts.noOpenShift')}</Alert>}
        {direction === 'OUT' && (
          <>
            <h3 className="ds-heading">{t('suppliers.covers')}</h3>
            <Stack gap={2}>
              {preview.length === 0 && (
                <Text size="sm" className="ds-muted">
                  {t('suppliers.noOpen')}
                </Text>
              )}
              {preview.map(({ r, take }) => (
                <Group key={r.id} justify="space-between">
                  <Text size="sm" className={take > 0 ? undefined : 'ds-muted'} dir="ltr">
                    {r.number}
                  </Text>
                  <Text size="sm">
                    {money(take.toFixed(2))} / {money(r.open)}
                  </Text>
                </Group>
              ))}
            </Stack>
            {left > 0.004 && (
              <Alert color="blue" variant="light">
                {t('suppliers.aheadHint', { amount: money(left.toFixed(2)) })}
              </Alert>
            )}
          </>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.back')}
          </Button>
          <Button
            disabled={!(Number(amount) > 0) || blocked}
            loading={pay.isPending}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function CreditNoteDialog({
  supplier,
  onClose,
  receiptId: initialReceipt,
}: {
  supplier: SupplierView;
  onClose: () => void;
  receiptId?: string;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const { creditNote } = usePurchasingActions();
  const receipts = useReceipts({ supplierId: supplier.id, pageSize: 100 });
  const [kind, setKind] = useState<'RETURN' | 'ALLOWANCE'>('RETURN');
  const [receiptId, setReceiptId] = useState<string | null>(initialReceipt ?? null);
  const receipt = useReceipt(receiptId ?? undefined);
  const [backQty, setBackQty] = useState<Record<string, number>>({});
  const [loose, setLoose] = useState<CostLine[]>([]);
  const [fromDamaged, setFromDamaged] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [key] = useState(newIdempotencyKey);

  const lines =
    kind !== 'RETURN'
      ? []
      : receiptId
        ? (receipt.data?.lines ?? [])
            .filter((l) => (backQty[l.id] ?? 0) > 0)
            .map((l) => ({
              itemId: l.itemId,
              quantity: backQty[l.id]!,
              unitCredit: l.landedCost,
              fromDamaged,
            }))
        : loose
            .filter((l) => isCost(l.unitCost))
            .map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitCredit: l.unitCost,
              fromDamaged,
            }));
  const total =
    kind === 'ALLOWANCE'
      ? Number(amount) || 0
      : receiptId
        ? lines.reduce((s, l) => s + Math.round(l.quantity * Number(l.unitCredit) * 100) / 100, 0)
        : loose.reduce((s, l) => s + lineValue(l), 0);

  const submit = async () => {
    try {
      await creditNote.mutateAsync({
        idempotencyKey: key,
        supplierId: supplier.id,
        kind,
        receiptId: receiptId ?? undefined,
        supplierRef: supplierRef || undefined,
        reason: reason.trim(),
        lines,
        amount: kind === 'ALLOWANCE' ? Number(amount).toFixed(2) : undefined,
      });
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('purchasing.creditNote')} centered size="lg">
      <Stack>
        <SegmentedControl
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          data={[
            { value: 'RETURN', label: t('purchasing.creditKind.RETURN') },
            { value: 'ALLOWANCE', label: t('purchasing.creditKind.ALLOWANCE') },
          ]}
        />
        <Select
          label={t('purchasing.receipt')}
          placeholder={t('purchasing.anyReceipt')}
          clearable
          value={receiptId}
          onChange={(v) => {
            setReceiptId(v);
            setBackQty({});
          }}
          data={(receipts.data?.items ?? []).map((r) => ({
            value: r.id,
            label: `${r.number} · ${formatDate(r.createdAt, i18n.language)} · ${money(r.total)}`,
          }))}
        />
        {kind === 'RETURN' && receiptId && (
          <Stack gap={6}>
            {(receipt.data?.lines ?? []).map((l) => {
              const left = l.quantity - l.returned;
              return (
                <Group key={l.id} justify="space-between" wrap="nowrap">
                  <div className="ds-min-0">
                    <Text size="sm" truncate>
                      {localize(l.name, i18n.language)}
                      {l.variantLabel ? ` · ${localize(l.variantLabel, i18n.language)}` : ''}
                    </Text>
                    <Text size="xs" className="ds-muted">
                      {money(l.landedCost)} · {t('purchasing.canReturn', { count: left })}
                    </Text>
                  </div>
                  <NumberInput
                    className={classes.qtyNarrow}
                    size="xs"
                    min={0}
                    max={left}
                    allowDecimal={false}
                    disabled={left <= 0}
                    value={backQty[l.id] ?? 0}
                    onChange={(v) =>
                      setBackQty({
                        ...backQty,
                        [l.id]: Math.min(left, Math.max(0, Number(v) || 0)),
                      })
                    }
                  />
                </Group>
              );
            })}
          </Stack>
        )}
        {kind === 'RETURN' && !receiptId && (
          <PurchaseLinesEditor lines={loose} onChange={setLoose} />
        )}
        {kind === 'RETURN' && (
          <Switch
            label={t('purchasing.fromDamaged')}
            checked={fromDamaged}
            onChange={(e) => setFromDamaged(e.currentTarget.checked)}
          />
        )}
        {kind === 'ALLOWANCE' && (
          <MoneyInput label={t('sales.amount')} required value={amount} onChange={setAmount} />
        )}
        <TextInput
          label={t('purchasing.supplierRef')}
          value={supplierRef}
          onChange={(e) => setSupplierRef(e.currentTarget.value)}
        />
        <Textarea
          label={t('common.reason')}
          required
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="space-between">
          <Text className="ds-bold">{money(total.toFixed(2))}</Text>
          <Group>
            <Button variant="default" onClick={onClose}>
              {t('common.back')}
            </Button>
            <Button
              disabled={total <= 0 || reason.trim().length < 3}
              loading={creditNote.isPending}
              onClick={() => void submit()}
            >
              {t('common.save')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
