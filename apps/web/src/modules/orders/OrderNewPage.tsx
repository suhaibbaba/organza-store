import {
  Alert,
  Button,
  Card,
  Group,
  Input,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  addMoney,
  type CustomerView,
  type DeliveryMethod,
  multiplyMoney,
  SALE_SOURCES,
  type SaleSource,
} from '@organza/shared';
import { IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useMoney } from '@web/modules/catalogue/components';
import { CustomerPicker } from '@web/modules/sales/CustomerPicker';
import { PageHeader } from '@web/shared/components/PageHeader';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError, newIdempotencyKey } from '@web/shared/lib/api-client';
import { useCouriers, useOrderActions } from './api';
import { type DraftLine, OrderLinesEditor } from './OrderLinesEditor';
import classes from './orders.module.css';

/** Taking an order from WhatsApp, the phone or the web (workflow D "Order preparation"). */
export function OrderNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const couriers = useCouriers();
  const { create } = useOrderActions();
  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [picking, setPicking] = useState(false);
  const [source, setSource] = useState<SaleSource>('WHATSAPP');
  const [delivery, setDelivery] = useState<DeliveryMethod>('COURIER');
  const [courierId, setCourierId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [key, setKey] = useState(newIdempotencyKey);
  const [duplicate, setDuplicate] = useState<{ number: string } | null>(null);

  const total = addMoney('0', ...lines.map((l) => multiplyMoney(l.unitPrice, l.quantity)));
  const active = (couriers.data ?? []).filter((c) => c.isActive);

  const submit = async (confirmDuplicate = false) => {
    if (!customer) return;
    try {
      const order = await create.mutateAsync({
        idempotencyKey: confirmDuplicate ? newIdempotencyKey() : key,
        source,
        customerId: customer.id,
        delivery,
        courierId: delivery === 'COURIER' ? (courierId ?? undefined) : undefined,
        address: address || undefined,
        city: city || undefined,
        note: note || undefined,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        confirmDuplicate,
      });
      notifications.show({
        color: 'green',
        message: t('orders.created', { number: order.number }),
      });
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'POSSIBLE_DUPLICATE') {
        setKey(newIdempotencyKey());
        setDuplicate({
          number: String((e.body?.details as { number?: string } | undefined)?.number ?? ''),
        });
        return;
      }
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <>
      <PageHeader title={t('orders.new')} back={{ to: '/orders', label: t('nav.orders') }} />
      <div className={classes.form}>
        <Card>
          <Stack gap="sm">
            <h2 className="ds-heading">{t('pos.customer')}</h2>
            <UnstyledButton
              className={classes.customer}
              onClick={() => setPicking(true)}
              aria-label={t('orders.chooseCustomer')}
            >
              <IconUser size={18} className="ds-shrink-0" />
              {customer ? (
                <Text size="sm" truncate className="ds-bold ds-ink">
                  {customer.name}
                  {customer.phone ? (
                    <Text span size="sm" dir="ltr" className="ds-regular ds-muted">
                      {' '}
                      {customer.phone}
                    </Text>
                  ) : null}
                </Text>
              ) : (
                <Text size="sm" className="ds-muted">
                  {t('orders.chooseCustomer')}
                </Text>
              )}
            </UnstyledButton>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label={t('orders.sourceLabel')}
                allowDeselect={false}
                value={source}
                onChange={(v) => setSource((v as SaleSource) ?? 'WHATSAPP')}
                data={SALE_SOURCES.map((s) => ({ value: s, label: t(`orders.source.${s}`) }))}
              />
              <Input.Wrapper label={t('orders.deliveryLabel')}>
                <SegmentedControl
                  fullWidth
                  value={delivery}
                  onChange={(v) => setDelivery(v as DeliveryMethod)}
                  data={[
                    { value: 'COURIER', label: t('orders.delivery.COURIER') },
                    { value: 'PICKUP', label: t('orders.delivery.PICKUP') },
                  ]}
                />
              </Input.Wrapper>
            </SimpleGrid>
            {delivery === 'COURIER' && (
              <>
                <Select
                  label={t('orders.courier')}
                  placeholder={t('orders.courierLater')}
                  clearable
                  value={courierId}
                  onChange={setCourierId}
                  data={active.map((c) => ({ value: c.id, label: c.name }))}
                />
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label={t('orders.city')}
                    value={city}
                    placeholder={customer?.city ?? ''}
                    onChange={(e) => setCity(e.currentTarget.value)}
                  />
                  <TextInput
                    label={t('orders.address')}
                    value={address}
                    placeholder={customer?.address ?? ''}
                    onChange={(e) => setAddress(e.currentTarget.value)}
                  />
                </SimpleGrid>
              </>
            )}
            <Textarea
              label={t('common.note')}
              autosize
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap="sm">
            <h2 className="ds-heading">{t('orders.lines')}</h2>
            <OrderLinesEditor lines={lines} onChange={setLines} />
            <div className={`${classes.total} ds-divider-top`}>
              <span>{t('sales.total')}</span>
              <span className="ds-num">{money(total)}</span>
            </div>
          </Stack>
        </Card>
      </div>
      <Group justify="flex-end" className="ds-mt-md">
        <Button variant="default" onClick={() => navigate('/orders')}>
          {t('common.back')}
        </Button>
        <Button
          disabled={!customer || lines.length === 0}
          loading={create.isPending}
          onClick={() => void submit()}
        >
          {t('orders.save')}
        </Button>
      </Group>
      <CustomerPicker
        opened={picking}
        onClose={() => setPicking(false)}
        onPick={(c) => {
          setCustomer(c);
          setPicking(false);
        }}
      />
      <Modal
        opened={Boolean(duplicate)}
        onClose={() => setDuplicate(null)}
        title={t('orders.duplicateTitle')}
        centered
      >
        <Stack>
          <Alert color="orange">{t('orders.duplicateHint', { number: duplicate?.number })}</Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDuplicate(null)}>
              {t('common.back')}
            </Button>
            <Button
              color="orange"
              onClick={() => {
                setDuplicate(null);
                void submit(true);
              }}
            >
              {t('orders.saveAnyway')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
