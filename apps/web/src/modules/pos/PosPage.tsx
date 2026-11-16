import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Drawer,
  Group,
  Indicator,
  Loader,
  Menu,
  Modal,
  Paper,
  Popover,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { localize, multiplyMoney, type SaleView } from '@organza/shared';
import {
  IconCashRegister,
  IconDiscount2,
  IconLayoutGrid,
  IconMinus,
  IconPhoto,
  IconPlayerPause,
  IconPlus,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMoney } from '@web/modules/catalogue/components';
import { deviceRegister, useRegisters, useShiftMutations } from '@web/modules/sales/api';
import { CustomerPicker } from '@web/modules/sales/CustomerPicker';
import { ReceiptDialog } from '@web/modules/sales/ReceiptDialog';
import { useDefaultCurrency } from '@web/modules/settings/api';
import { MoneyInput } from '@web/shared/components/MoneyInput';
import { useBarcodeScanner } from '@web/shared/hooks/use-barcode-scanner';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { formatDateTime } from '@web/shared/lib/format';
import { type CartApi, cartTotals, MAX_PARKED, useCart } from './cart';
import { PaymentPanel } from './PaymentPanel';
import { useItemChooser } from './picking';
import { ProductBrowser } from './ProductBrowser';
import classes from '../sales/sales.module.css';

/** The till: pick the device's register, open a shift if needed, then sell. */
export function PosPage() {
  const registers = useRegisters();
  const [registerId, setRegisterId] = useState<string | null>(() => deviceRegister.get());
  const list = registers.data ?? [];
  const register =
    list.find((r) => r.id === registerId) ?? (list.length === 1 ? list[0] : undefined);

  if (registers.isLoading)
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  if (!register?.openShift)
    return (
      <ShiftGate
        registerId={register?.id ?? null}
        onRegister={(id) => {
          deviceRegister.set(id);
          setRegisterId(id);
        }}
      />
    );
  return (
    <Till
      registerId={register.id}
      registerName={register.name}
      shiftId={register.openShift.id}
      shiftNumber={register.openShift.number}
    />
  );
}

function ShiftGate({
  registerId,
  onRegister,
}: {
  registerId: string | null;
  onRegister: (id: string) => void;
}) {
  const { t } = useTranslation();
  const registers = useRegisters();
  const currency = useDefaultCurrency();
  const { open } = useShiftMutations();
  const errorMessage = useErrorMessage();
  const [float, setFloat] = useState('');
  const [note, setNote] = useState('');
  const [needsNote, setNeedsNote] = useState(false);
  const active = (registers.data ?? []).filter((r) => r.isActive);
  const counted = active.find((r) => r.id === registerId)?.countedShiftId;

  const submit = async () => {
    if (!registerId) return;
    try {
      await open.mutateAsync({
        registerId,
        float: float ? [{ currency, amount: Number(float).toFixed(2) }] : [],
        note: note || undefined,
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'NOTE_REQUIRED') setNeedsNote(true);
      else notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Center h="100%" p="md">
      <Paper withBorder p="lg" radius="md" w={380} maw="100%">
        <Stack>
          <Group gap="xs">
            <IconCashRegister />
            <Title order={3}>{t('pos.openShift')}</Title>
          </Group>
          <Select
            label={t('pos.register')}
            data={active.map((r) => ({ value: r.id, label: r.name }))}
            value={registerId}
            onChange={(v) => v && onRegister(v)}
            allowDeselect={false}
          />
          {counted ? (
            <>
              <Text size="sm">{t('pos.closeCountedFirst')}</Text>
              <Button component={Link} to="/shift">
                {t('shifts.close')}
              </Button>
            </>
          ) : (
            <>
              <MoneyInput
                label={t('pos.float')}
                description={t('pos.floatHint')}
                value={float}
                onChange={setFloat}
              />
              {needsNote && (
                <Textarea
                  label={t('pos.floatDiffers')}
                  required
                  autosize
                  minRows={2}
                  value={note}
                  onChange={(e) => setNote(e.currentTarget.value)}
                />
              )}
              <Button
                onClick={() => void submit()}
                loading={open.isPending}
                disabled={!registerId || (needsNote && !note)}
              >
                {t('pos.openShift')}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}

function Till({
  registerId,
  registerName,
  shiftId,
  shiftNumber,
}: {
  registerId: string;
  registerName: string;
  shiftId: string;
  shiftNumber: string;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const cart = useCart(registerId);
  const searchRef = useRef<HTMLInputElement>(null);
  const [paying, setPaying] = useState(false);
  const [picking, setPicking] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [discounting, setDiscounting] = useState(false);
  const [done, setDone] = useState<SaleView | null>(null);

  const chooser = useItemChooser((line) => {
    if (line.available <= 0) {
      notifications.show({ color: 'red', message: t('pos.soldOut') });
      return;
    }
    cart.add(line);
    setBrowsing(false);
  });
  const onCode = useCallback(
    async (code: string) => {
      try {
        const found = await chooser.pickCode(code);
        if (!found)
          notifications.show({ color: 'orange', message: t('pos.codeNotFound', { code }) });
        return found;
      } catch (e) {
        notifications.show({ color: 'red', message: errorMessage(e) });
        return false;
      }
    },
    [chooser, errorMessage, t],
  );
  const modalOpen = paying || picking || discounting || Boolean(done);
  useBarcodeScanner((code) => void onCode(code), !modalOpen);

  const focusSearch = () => searchRef.current?.focus();
  const canPay = cart.cart.lines.length > 0;
  useHotkeys(
    [
      ['F2', focusSearch],
      ['F4', () => setPicking(true)],
      ['F6', () => canPay && setDiscounting(true)],
      ['F8', () => canPay && setPaying(true)],
      ['F9', () => cart.park()],
    ],
    [],
  );
  useEffect(() => {
    if (!modalOpen) focusSearch();
  }, [modalOpen]);

  const browser = (
    <ProductBrowser
      searchRef={searchRef}
      onProduct={(id) =>
        void chooser
          .pickProduct(id)
          .catch((e: unknown) => notifications.show({ color: 'red', message: errorMessage(e) }))
      }
      onCode={onCode}
    />
  );

  return (
    <div className={classes.pos}>
      <section className={classes.browser}>{browser}</section>
      <CartPanel
        cart={cart}
        registerName={registerName}
        shiftNumber={shiftNumber}
        onPay={() => setPaying(true)}
        onCustomer={() => setPicking(true)}
        onDiscount={() => setDiscounting(true)}
        onBrowse={() => setBrowsing(true)}
      />
      {chooser.picker}
      <Drawer
        opened={browsing}
        onClose={() => setBrowsing(false)}
        position="bottom"
        size="90%"
        title={t('pos.browse')}
      >
        <Stack gap="sm" h="70vh">
          {browsing && browser}
        </Stack>
      </Drawer>
      <CustomerPicker
        opened={picking}
        onClose={() => setPicking(false)}
        onPick={(c) => {
          cart.setCustomer({
            id: c.id,
            name: c.name,
            phone: c.phone,
            debt: c.debt,
            credit: c.credit,
          });
          setPicking(false);
        }}
      />
      <CartDiscount opened={discounting} onClose={() => setDiscounting(false)} cart={cart} />
      <PaymentPanel
        opened={paying}
        onClose={() => setPaying(false)}
        cart={cart}
        shiftId={shiftId}
        onDone={(sale) => {
          setPaying(false);
          cart.clear();
          setDone(sale);
        }}
      />
      <ReceiptDialog
        saleId={done?.id ?? null}
        replayed={done?.replayed}
        closeLabel={t('pos.nextSale')}
        onClose={() => setDone(null)}
      />
    </div>
  );
}

function CartPanel({
  cart,
  registerName,
  shiftNumber,
  onPay,
  onCustomer,
  onDiscount,
  onBrowse,
}: {
  cart: CartApi;
  registerName: string;
  shiftNumber: string;
  onPay: () => void;
  onCustomer: () => void;
  onDiscount: () => void;
  onBrowse: () => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const totals = cartTotals(cart.cart);
  const customer = cart.cart.customer;
  return (
    <section className={classes.cart}>
      <div className={classes.cartHead}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Badge variant="light" component={Link} to="/shift" style={{ cursor: 'pointer' }}>
              {registerName} · {shiftNumber}
            </Badge>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Button
              className={classes.browseButton}
              size="xs"
              variant="light"
              leftSection={<IconLayoutGrid size={14} />}
              onClick={onBrowse}
            >
              {t('pos.browse')}
            </Button>
            <Menu position="bottom-end" width={260}>
              <Menu.Target>
                <Indicator label={cart.parked.length} size={16} disabled={cart.parked.length === 0}>
                  <ActionIcon variant="default" aria-label={t('pos.parked')}>
                    <IconPlayerPause size={16} />
                  </ActionIcon>
                </Indicator>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  disabled={cart.cart.lines.length === 0 || cart.parked.length >= MAX_PARKED}
                  onClick={cart.park}
                  leftSection={<IconPlayerPause size={14} />}
                >
                  {t('pos.park')} (F9)
                </Menu.Item>
                {cart.parked.length > 0 && <Menu.Divider />}
                {cart.parked.map((p, i) => (
                  <Menu.Item key={p.idempotencyKey} onClick={() => cart.resume(i)}>
                    <Text size="sm">
                      {p.customer?.name ??
                        t('pos.parkedCart', { count: p.lines.reduce((n, l) => n + l.quantity, 0) })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {p.parkedAt ? formatDateTime(p.parkedAt, i18n.language) : ''} ·{' '}
                      {money(cartTotals(p).total)}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
        <UnstyledButton onClick={onCustomer} aria-label={t('pos.customer')}>
          <Group gap={6} wrap="nowrap">
            <IconUser size={18} />
            {customer ? (
              <Group gap={6} wrap="nowrap" style={{ flex: 1 }}>
                <Text fw={600} truncate>
                  {customer.name}
                </Text>
                {Number(customer.debt) > 0 && (
                  <Badge color="red" variant="light" size="sm">
                    {t('customers.owes', { amount: money(customer.debt) })}
                  </Badge>
                )}
                {Number(customer.credit) > 0 && (
                  <Badge color="green" variant="light" size="sm">
                    {t('customers.hasCredit', { amount: money(customer.credit) })}
                  </Badge>
                )}
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  aria-label={t('common.remove')}
                  onClick={(e) => {
                    e.stopPropagation();
                    cart.setCustomer(null);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Text c="dimmed">{t('pos.addCustomer')} (F4)</Text>
            )}
          </Group>
        </UnstyledButton>
      </div>

      <div className={`${classes.cartLines} organza-scroll`}>
        {cart.cart.lines.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {t('pos.emptyCartHint')}
          </Text>
        )}
        {cart.cart.lines.map((l) => (
          <div
            key={l.key}
            className={`${classes.cartLine} ${l.problem ? classes.cartLineError : ''}`}
          >
            {l.imageUrl ? (
              <img
                src={l.imageUrl}
                alt=""
                width={40}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4 }}
              />
            ) : (
              <Center w={40} h={60} bg="gray.1" style={{ borderRadius: 4 }}>
                <IconPhoto size={16} />
              </Center>
            )}
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {localize(l.name, i18n.language)}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {[l.variantLabel, l.sku].filter(Boolean).join(' · ')}
              </Text>
              {l.problem && (
                <Text size="xs" c="red">
                  {t(`pos.problem.${l.problem}`)}
                </Text>
              )}
              <Group gap={4} mt={4}>
                <ActionIcon
                  size="sm"
                  variant="default"
                  aria-label="-"
                  onClick={() => cart.setQuantity(l.key, l.quantity - 1)}
                >
                  <IconMinus size={12} />
                </ActionIcon>
                <Text size="sm" w={24} ta="center">
                  {l.quantity}
                </Text>
                <ActionIcon
                  size="sm"
                  variant="default"
                  aria-label="+"
                  disabled={l.quantity >= l.available}
                  onClick={() => cart.setQuantity(l.key, l.quantity + 1)}
                >
                  <IconPlus size={12} />
                </ActionIcon>
                <LineDiscount
                  cart={cart}
                  lineKey={l.key}
                  gross={multiplyMoney(l.unitPrice, l.quantity)}
                  value={l.discount}
                />
              </Group>
            </div>
            <Stack gap={0} align="flex-end">
              <Text size="sm" fw={600}>
                {money(multiplyMoney(l.unitPrice, l.quantity))}
              </Text>
              {Number(l.discount) > 0 && (
                <Text size="xs" c="green.8">
                  −{money(l.discount)}
                </Text>
              )}
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                aria-label={t('common.remove')}
                onClick={() => cart.remove(l.key)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Stack>
          </div>
        ))}
      </div>

      <div className={classes.cartFoot}>
        {Number(totals.discountTotal) > 0 && (
          <div className={classes.totalRow}>
            <Text size="sm">{t('sales.discount')}</Text>
            <Text size="sm" c="green.8">
              −{money(totals.discountTotal)}
            </Text>
          </div>
        )}
        <div className={classes.totalRow}>
          <Text>{t('pos.items', { count: totals.count })}</Text>
          <span className={classes.bigTotal}>{money(totals.total)}</span>
        </div>
        <Group grow gap="xs">
          <Button
            variant="default"
            leftSection={<IconDiscount2 size={16} />}
            disabled={!cart.cart.lines.length}
            onClick={onDiscount}
          >
            {t('pos.discount')} (F6)
          </Button>
          <Button
            variant="default"
            color="red"
            disabled={!cart.cart.lines.length}
            onClick={cart.clear}
          >
            {t('pos.clear')}
          </Button>
        </Group>
        <Button size="xl" onClick={onPay} disabled={!cart.cart.lines.length}>
          {t('pos.pay')} (F8)
        </Button>
      </div>
    </section>
  );
}

function LineDiscount({
  cart,
  lineKey,
  gross,
  value,
}: {
  cart: CartApi;
  lineKey: string;
  gross: string;
  value: string;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(value === '0.00' ? '' : value);
  const percent = (p: number) => ((Number(gross) * p) / 100).toFixed(2);
  return (
    <Popover position="bottom" withArrow trapFocus>
      <Popover.Target>
        <ActionIcon
          size="sm"
          variant={Number(value) > 0 ? 'light' : 'subtle'}
          aria-label={t('pos.lineDiscount')}
        >
          <IconDiscount2 size={14} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={200}>
          <MoneyInput label={t('pos.lineDiscount')} value={amount} onChange={setAmount} size="xs" />
          <Group gap={4}>
            {[5, 10, 20].map((p) => (
              <Button
                key={p}
                size="compact-xs"
                variant="default"
                onClick={() => setAmount(percent(p))}
              >
                {p}%
              </Button>
            ))}
          </Group>
          <Button
            size="xs"
            onClick={() =>
              cart.setLineDiscount(lineKey, Math.min(Number(amount || 0), Number(gross)).toFixed(2))
            }
          >
            {t('common.save')}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function CartDiscount({
  opened,
  onClose,
  cart,
}: {
  opened: boolean;
  onClose: () => void;
  cart: CartApi;
}) {
  const { t } = useTranslation();
  const money = useMoney();
  const [amount, setAmount] = useState('');
  const { subtotal } = cartTotals({ ...cart.cart, cartDiscount: '0.00' });
  useEffect(() => {
    if (opened) setAmount(cart.cart.cartDiscount === '0.00' ? '' : cart.cart.cartDiscount);
  }, [opened, cart.cart.cartDiscount]);
  return (
    <Modal opened={opened} onClose={onClose} title={t('pos.cartDiscount')} centered size="sm">
      <Stack>
        <Text size="sm" c="dimmed">
          {t('pos.cartDiscountHint', { amount: money(subtotal) })}
        </Text>
        <MoneyInput data-autofocus value={amount} onChange={setAmount} size="md" />
        <Group gap={6}>
          {[5, 10, 15, 20].map((p) => (
            <Button
              key={p}
              variant="default"
              size="xs"
              onClick={() => setAmount(((Number(subtotal) * p) / 100).toFixed(2))}
            >
              {p}%
            </Button>
          ))}
        </Group>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              cart.setCartDiscount('0.00');
              onClose();
            }}
          >
            {t('pos.noDiscount')}
          </Button>
          <Button
            onClick={() => {
              cart.setCartDiscount(Number(amount || 0).toFixed(2));
              onClose();
            }}
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
