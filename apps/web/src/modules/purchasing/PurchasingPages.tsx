import { BackLink } from '@web/shared/components/PageHeader';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { localize } from '@organza/shared';
import { IconPackageImport, IconPlus, IconTags } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { PageHeader } from '@web/shared/components/PageHeader';
import { ErrorState, FullScreenLoader } from '@web/shared/components/StatusScreens';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { formatDate, formatDateTime } from '@web/shared/lib/format';
import { usePurchaseOrder, usePurchasingActions, useReceipt, useSupplier } from './api';
import {
  CreditNoteDialog,
  OrdersTable,
  PayDialog,
  PO_COLORS,
  ReceiptsTable,
} from './SupplierDetailPage';

/** Purchasing home: receipts, open orders, and the way in to receiving. */
export function PurchasingPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState<'all' | 'open'>('all');
  return (
    <>
      <PageHeader
        title={t('nav.purchasing')}
        actions={
          <>
            {can('purchasing.order') && (
              <Button
                variant="default"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/purchasing/orders/new')}
              >
                {t('purchasing.newOrder')}
              </Button>
            )}
            <Button
              leftSection={<IconPackageImport size={16} />}
              onClick={() => navigate('/purchasing/receive')}
            >
              {t('purchasing.receive')}
            </Button>
          </>
        }
      />
      <Tabs defaultValue={can('suppliers.view') ? 'receipts' : 'orders'} keepMounted={false}>
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Tabs.List>
            {can('suppliers.view') && (
              <Tabs.Tab value="receipts">{t('purchasing.receipts')}</Tabs.Tab>
            )}
            <Tabs.Tab value="orders">{t('purchasing.orders')}</Tabs.Tab>
          </Tabs.List>
          <SegmentedControl
            size="xs"
            value={open}
            onChange={(v) => setOpen(v as typeof open)}
            data={[
              { value: 'all', label: t('suppliers.all') },
              { value: 'open', label: t('purchasing.openOnly') },
            ]}
          />
        </Group>
        <Tabs.Panel value="receipts">
          <ReceiptsTable open={open === 'open' || undefined} />
        </Tabs.Panel>
        <Tabs.Panel value="orders">
          <OrdersTable open={open === 'open' || undefined} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

/** One receipt: what arrived at what landed cost, what is still owed; labels for the pieces. */
export function ReceiptPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const money = useMoney();
  const query = useReceipt(id);
  const supplier = useSupplier(can('suppliers.view') ? query.data?.supplier.id : undefined);
  const [dialog, setDialog] = useState<'pay' | 'credit' | null>(null);
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const r = query.data;
  const products = [...new Set(r.lines.map((l) => l.productId))];

  return (
    <>
      <BackLink to="/purchasing" label={t('nav.purchasing')} />
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={1} size="h2" dir="ltr" ta="start">
            {r.number}
          </Title>
          <Text size="sm" c="dimmed">
            {can('suppliers.view') ? (
              <Anchor component={Link} to={`/suppliers/${r.supplier.id}`}>
                {r.supplier.name}
              </Anchor>
            ) : (
              r.supplier.name
            )}
            {r.supplierRef ? ` · ${r.supplierRef}` : ''} ·{' '}
            {formatDateTime(r.createdAt, i18n.language)} · {r.createdBy}
          </Text>
          {r.purchaseOrder && (
            <Anchor component={Link} to={`/purchasing/orders/${r.purchaseOrder.id}`} size="sm">
              {t('purchasing.order')} <span dir="ltr">{r.purchaseOrder.number}</span>
            </Anchor>
          )}
        </Stack>
        <Group gap="xs">
          {can('labels.print') && (
            <Button
              variant={params.get('fresh') ? 'filled' : 'default'}
              leftSection={<IconTags size={16} />}
              onClick={() => navigate(`/labels?products=${products.join(',')}`)}
            >
              {t('purchasing.printLabels')}
            </Button>
          )}
          {can('suppliers.pay') && Number(r.open) > 0 && supplier.data && (
            <Button variant="light" onClick={() => setDialog('pay')}>
              {t('suppliers.pay')}
            </Button>
          )}
          {can('purchasing.credit') && supplier.data && (
            <Button variant="default" onClick={() => setDialog('credit')}>
              {t('purchasing.creditNote')}
            </Button>
          )}
        </Group>
      </Group>
      {params.get('fresh') && can('labels.print') && (
        <Alert color="green" mb="md">
          {t('purchasing.labelsHint')}
        </Alert>
      )}
      <Card withBorder p={0} mb="md">
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('catalogue.name')}</Table.Th>
                <Table.Th>{t('sales.quantity')}</Table.Th>
                <Table.Th ta="end">{t('purchasing.unitCost')}</Table.Th>
                <Table.Th ta="end">{t('purchasing.landedCost')}</Table.Th>
                <Table.Th ta="end">{t('sales.total')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {r.lines.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/products/${l.productId}`} size="sm">
                      {localize(l.name, i18n.language)}
                    </Anchor>
                    <Text size="xs" c="dimmed">
                      {[l.variantLabel ? localize(l.variantLabel, i18n.language) : null, l.sku]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {l.returned > 0 && (
                      <Badge size="xs" color="orange">
                        {t('purchasing.returnedCount', { count: l.returned })}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{l.quantity}</Table.Td>
                  <Table.Td ta="end">{money(l.unitCost)}</Table.Td>
                  <Table.Td ta="end">{money(l.landedCost)}</Table.Td>
                  <Table.Td ta="end">{money(l.lineTotal)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Card withBorder maw={360} ms="auto">
        <Stack gap={4}>
          <Row label={t('purchasing.subtotal')} value={money(r.subtotal)} />
          {Number(r.extraCosts) > 0 && (
            <Row label={t('purchasing.extraCosts')} value={money(r.extraCosts)} />
          )}
          <Row label={t('sales.total')} value={money(r.total)} strong />
          <Row label={t('purchasing.settled')} value={money(r.paid)} />
          <Row label={t('purchasing.open')} value={money(r.open)} strong />
        </Stack>
        {r.note && (
          <Text size="sm" c="dimmed" mt="xs">
            {r.note}
          </Text>
        )}
      </Card>
      {dialog === 'pay' && supplier.data && (
        <PayDialog supplier={supplier.data} receiptId={r.id} onClose={() => setDialog(null)} />
      )}
      {dialog === 'credit' && supplier.data && (
        <CreditNoteDialog
          supplier={supplier.data}
          receiptId={r.id}
          onClose={() => setDialog(null)}
        />
      )}
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

/** One purchase order: what was asked for, what arrived, receive the rest or close it. */
export function PurchaseOrderPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const money = useMoney();
  const query = usePurchaseOrder(id);
  const [closing, setClosing] = useState(false);
  if (query.isPending) return <FullScreenLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const po = query.data;
  return (
    <>
      <BackLink to="/purchasing" label={t('nav.purchasing')} />
      <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Group gap="xs">
            <Title order={1} size="h2" dir="ltr">
              {po.number}
            </Title>
            <Badge color={PO_COLORS[po.status]}>{t(`purchasing.status.${po.status}`)}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {po.supplier.name} · {formatDate(po.createdAt, i18n.language)} · {po.createdBy}
            {po.expectedAt
              ? ` · ${t('purchasing.expected')} ${formatDate(po.expectedAt, i18n.language)}`
              : ''}
          </Text>
        </Stack>
        {po.status === 'OPEN' && (
          <Group gap="xs">
            {can('purchasing.receive') && (
              <Button
                leftSection={<IconPackageImport size={16} />}
                onClick={() => navigate(`/purchasing/receive?orderId=${po.id}`)}
              >
                {t('purchasing.receive')}
              </Button>
            )}
            {can('purchasing.order') && (
              <Button variant="default" onClick={() => setClosing(true)}>
                {t('purchasing.close')}
              </Button>
            )}
          </Group>
        )}
      </Group>
      {po.closeReason && (
        <Alert color="gray" mb="md">
          {po.closeReason}
        </Alert>
      )}
      <Card withBorder p={0} mb="md">
        <Table.ScrollContainer minWidth={520}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('catalogue.name')}</Table.Th>
                <Table.Th>{t('purchasing.arrived')}</Table.Th>
                <Table.Th ta="end">{t('purchasing.unitCost')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {po.lines.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    {localize(l.name, i18n.language)}
                    <Text size="xs" c="dimmed">
                      {[l.variantLabel ? localize(l.variantLabel, i18n.language) : null, l.sku]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Table.Td>
                  <Table.Td c={l.open > 0 ? 'orange.8' : 'green.8'}>
                    {l.received} / {l.quantity}
                  </Table.Td>
                  <Table.Td ta="end">{money(l.unitCost)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          {po.receipts.map((r) => (
            <Anchor key={r.id} component={Link} to={`/purchasing/receipts/${r.id}`} size="sm">
              <span dir="ltr">{r.number}</span> · {formatDate(r.createdAt, i18n.language)}
            </Anchor>
          ))}
          {po.note && (
            <Text size="sm" c="dimmed">
              {po.note}
            </Text>
          )}
        </Stack>
        <Text fw={700}>{money(po.total)}</Text>
      </Group>
      {closing && (
        <CloseOrderDialog
          id={po.id}
          canCancel={po.receipts.length === 0}
          onClose={() => setClosing(false)}
        />
      )}
    </>
  );
}

function CloseOrderDialog({
  id,
  canCancel,
  onClose,
}: {
  id: string;
  canCancel: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { closeOrder } = usePurchasingActions();
  const [outcome, setOutcome] = useState<'CLOSED' | 'CANCELLED'>(
    canCancel ? 'CANCELLED' : 'CLOSED',
  );
  const [reason, setReason] = useState('');
  const submit = async () => {
    try {
      await closeOrder.mutateAsync({ id, outcome, reason: reason.trim() });
      notifications.show({ color: 'green', message: t('common.saved') });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };
  return (
    <Modal opened onClose={onClose} title={t('purchasing.close')} centered>
      <Stack>
        <SegmentedControl
          value={outcome}
          onChange={(v) => setOutcome(v as typeof outcome)}
          data={[
            { value: 'CLOSED', label: t('purchasing.closeShort') },
            { value: 'CANCELLED', label: t('purchasing.cancelOrder'), disabled: !canCancel },
          ]}
        />
        <Text size="sm" c="dimmed">
          {outcome === 'CLOSED' ? t('purchasing.closeShortHint') : t('purchasing.cancelHint')}
        </Text>
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
            disabled={reason.trim().length < 3}
            loading={closeOrder.isPending}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
