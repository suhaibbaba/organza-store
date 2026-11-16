import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Indicator,
  Loader,
  Menu,
  Modal,
  Popover,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { localize, multiplyMoney, type SaleView } from '@organza/shared';
import {
  IconBolt,
  IconCashRegister,
  IconCheck,
  IconGift,
  IconDiscount2,
  IconDotsVertical,
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
import { useSession } from '@web/modules/auth/session';
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
import { QuickSellDialog } from './QuickSellDialog';
import { ProductBrowser } from './ProductBrowser';
import classes from './pos.module.css';

/** The till: pick the device's register, open a shift if needed, then sell. */
export function PosPage() {
  const registers = useRegisters();
  const [registerId, setRegisterId] = useState<string | null>(() => deviceRegister.get());
  const list = registers.data ?? [];
  const register =
    list.find((r) => r.id === registerId) ?? (list.length === 1 ? list[0] : undefined);

  if (registers.isLoading)
    return (
      <div className={classes.gate}>
        <Loader />
      </div>
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
    <div className={classes.gate}>
      <Card className="ds-w-sm">
        <Stack>
          <Group gap="xs">
            <IconCashRegister />
            <h2 className="ds-heading">{t('pos.openShift')}</h2>
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
      </Card>
    </div>
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
  const [quickSelling, setQuickSelling] = useState(false);
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
  const modalOpen = paying || picking || discounting || quickSelling || Boolean(done);
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
        onQuickSell={() => setQuickSelling(true)}
      />
      <QuickSellDialog
        opened={quickSelling}
        onClose={() => setQuickSelling(false)}
        onReady={(line) => {
          cart.add(line);
          setQuickSelling(false);
        }}
      />
      {chooser.picker}
      <Drawer
        opened={browsing}
        onClose={() => setBrowsing(false)}
        position="bottom"
        size="90%"
        title={t('pos.browse')}
      >
        <div className={classes.drawerBody}>{browsing && browser}</div>
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
        fresh
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
  onQuickSell,
}: {
  cart: CartApi;
  registerName: string;
  shiftNumber: string;
  onPay: () => void;
  onCustomer: () => void;
  onDiscount: () => void;
  onBrowse: () => void;
  onQuickSell: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const money = useMoney();
  const totals = cartTotals(cart.cart);
  const customer = cart.cart.customer;
  return (
    <section className={classes.cart}>
      <div className={classes.cartHead}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Badge variant="light" component={Link} to="/shift" className="ds-clickable">
              {registerName} · {shiftNumber}
            </Badge>
            {cart.cart.giftReceipt && (
              <Badge color="pink" variant="light" leftSection={<IconGift size={12} />}>
                {t('sales.giftPurchase')}
              </Badge>
            )}
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
                  <ActionIcon variant="default" aria-label={t('common.more')}>
                    <IconDotsVertical size={16} />
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
                {can('products.quickSell') && (
                  <Menu.Item leftSection={<IconBolt size={14} />} onClick={onQuickSell}>
                    {t('pos.quickSell')}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<IconGift size={14} />}
                  rightSection={cart.cart.giftReceipt ? <IconCheck size={14} /> : undefined}
                  onClick={() => cart.setGiftReceipt(!cart.cart.giftReceipt)}
                >
                  {t('sales.giftPurchase')}
                </Menu.Item>
                {cart.parked.length > 0 && <Menu.Divider />}
                {cart.parked.map((p, i) => (
                  <Menu.Item key={p.idempotencyKey} onClick={() => cart.resume(i)}>
                    <Text size="sm">
                      {p.customer?.name ??
                        t('pos.parkedCart', { count: p.lines.reduce((n, l) => n + l.quantity, 0) })}
                    </Text>
                    <Text size="xs" className="ds-muted">
                      {p.parkedAt ? formatDateTime(p.parkedAt, i18n.language) : ''} ·{' '}
                      {money(cartTotals(p).total)}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
        <UnstyledButton
          onClick={onCustomer}
          aria-label={t('pos.customer')}
          className={classes.customer}
        >
          <Group gap={8} wrap="nowrap" className="ds-grow">
            <IconUser size={18} className="ds-shrink-0" />
            {customer ? (
              <Group gap={6} wrap="nowrap" className="ds-grow">
                <Text size="sm" truncate className="ds-bold ds-ink">
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
              <Text size="sm" className="ds-muted">
                {t('pos.addCustomer')} (F4)
              </Text>
            )}
          </Group>
        </UnstyledButton>
      </div>

      <div className={`${classes.cartLines} organza-scroll`}>
        {cart.cart.lines.length === 0 && (
          <Text className="ds-muted ds-center ds-py-xl">{t('pos.emptyCartHint')}</Text>
        )}
        {cart.cart.lines.map((l) => (
          <div
            key={l.key}
            className={`${classes.cartLine} ${l.problem ? classes.cartLineError : ''}`}
          >
            {l.imageUrl ? (
              <img src={l.imageUrl} alt="" width={40} height={60} className={classes.thumb} />
            ) : (
              <div className={classes.thumb}>
                <IconPhoto size={16} />
              </div>
            )}
            <div className="ds-min-0">
              <Text size="sm" truncate className="ds-bold">
                {localize(l.name, i18n.language)}
              </Text>
              <Text size="xs" truncate className="ds-muted">
                {[l.variantLabel, l.sku].filter(Boolean).join(' · ')}
              </Text>
              {l.problem && (
                <Text size="xs" className="ds-danger">
                  {t(`pos.problem.${l.problem}`)}
                </Text>
              )}
              <Group gap={4} className="ds-mt-xs">
                <ActionIcon
                  size="sm"
                  variant="default"
                  aria-label="-"
                  onClick={() => cart.setQuantity(l.key, l.quantity - 1)}
                >
                  <IconMinus size={12} />
                </ActionIcon>
                <Text size="sm" className={`${classes.qty} ds-center ds-num`}>
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
                {!l.giveaway && (
                  <LineDiscount
                    cart={cart}
                    lineKey={l.key}
                    gross={multiplyMoney(l.unitPrice, l.quantity)}
                    value={l.discount}
                  />
                )}
                {can('sales.giveaway') && (
                  <Tooltip label={t('pos.giveaway')}>
                    <ActionIcon
                      size="sm"
                      variant={l.giveaway ? 'filled' : 'default'}
                      color="pink"
                      aria-label={t('pos.giveaway')}
                      aria-pressed={Boolean(l.giveaway)}
                      onClick={() => cart.toggleGiveaway(l.key)}
                    >
                      <IconGift size={12} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </div>
            <div className={classes.lineEnd}>
              {l.giveaway ? (
                <Badge size="sm" color="pink" variant="light">
                  {t('pos.giveaway')}
                </Badge>
              ) : (
                <Text size="sm" className="ds-bold ds-num">
                  {money(multiplyMoney(l.unitPrice, l.quantity))}
                </Text>
              )}
              {Number(l.discount) > 0 && (
                <Text size="xs" className="ds-success ds-num">
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
            </div>
          </div>
        ))}
      </div>

      <div className={classes.cartFoot}>
        <div className={classes.sum}>
          {Number(totals.discountTotal) > 0 && (
            <div className={classes.sumRow}>
              <span>{t('sales.discount')}</span>
              <span className="ds-success ds-num">−{money(totals.discountTotal)}</span>
            </div>
          )}
          <div className={classes.sumTotal}>
            <span className="ds-text-md ds-medium">{t('pos.items', { count: totals.count })}</span>
            <span className={classes.bigTotal}>{money(totals.total)}</span>
          </div>
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
        <Button fullWidth onClick={onPay} disabled={!cart.cart.lines.length}>
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
        <Stack gap="xs" className={classes.lineDiscount}>
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
        <Text size="sm" className="ds-muted">
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
