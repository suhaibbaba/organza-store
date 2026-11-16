import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  addMoney,
  compareMoney,
  fromMinor,
  multiplyMoney,
  type PaymentMethod,
  type SaleView,
  toMinor,
} from '@organza/shared';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoney } from '@web/modules/catalogue/components';
import { useCheckout } from '@web/modules/sales/api';
import { useCurrencies } from '@web/modules/settings/api';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError } from '@web/shared/lib/api-client';
import { formatMoney } from '@web/shared/lib/format';
import { type CartApi, cartTotals } from './cart';
import classes from '../sales/sales.module.css';

interface Tender {
  method: PaymentMethod;
  currency: string;
  amount: string;
  rate: string;
  reference?: string;
}

const neg = (v: string) => fromMinor(-toMinor(v));

/** Round cash amounts a customer is likely to hand over for `due`. */
function quickAmounts(due: string): string[] {
  const value = Number(due);
  if (value <= 0) return [];
  const steps = [10, 20, 50, 100, 200];
  const out = new Set<number>();
  for (const s of steps) out.add(Math.ceil(value / s) * s);
  return [...out]
    .filter((v) => v > value)
    .sort((a, b) => a - b)
    .slice(0, 4)
    .map((v) => v.toFixed(2));
}

/**
 * The payment panel (proposal F): total large, one key per method, quick cash, split payments,
 * taken or held, and what is left said in plain words. Saves with the cart's idempotency key.
 */
export function PaymentPanel({
  opened,
  onClose,
  cart,
  shiftId,
  onDone,
}: {
  opened: boolean;
  onClose: () => void;
  cart: CartApi;
  shiftId: string;
  onDone: (sale: SaleView) => void;
}) {
  const { t, i18n } = useTranslation();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const currencies = useCurrencies();
  const checkout = useCheckout();
  const phone = useMediaQuery('(max-width: 48em)') ?? false;
  const defaultCurrency = currencies.data?.find((c) => c.isDefault)?.code ?? 'ILS';
  const active = (currencies.data ?? []).filter((c) => c.isActive && (c.isDefault || c.rateSetAt));
  const { total } = cartTotals(cart.cart);
  const customer = cart.cart.customer;

  const [mode, setMode] = useState<'TAKEN' | 'HELD'>('TAKEN');
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [overpayment, setOverpayment] = useState<'CHANGE' | 'CREDIT'>('CHANGE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setTenders([]);
    setMode('TAKEN');
    setOverpayment('CHANGE');
    setError(null);
    setCurrency(defaultCurrency);
    setReference('');
  }, [opened, defaultCurrency]);

  const rateOf = (code: string) => active.find((c) => c.code === code)?.rate ?? '1';
  const valueOf = (tender: Pick<Tender, 'currency' | 'amount' | 'rate'>) =>
    tender.currency === defaultCurrency ? tender.amount : multiplyMoney(tender.amount, tender.rate);
  const paid = addMoney('0', ...tenders.map(valueOf));
  const left = addMoney(total, neg(paid));
  const owes = compareMoney(left, 0) > 0 ? left : '0.00';
  const over = compareMoney(left, 0) < 0 ? neg(left) : '0.00';
  const cashTendered = addMoney('0', ...tenders.filter((p) => p.method === 'CASH').map(valueOf));

  // The amount field suggests what is still due, in the chosen currency.
  const dueIn = useMemo(() => {
    if (compareMoney(owes, 0) <= 0) return '';
    if (currency === defaultCurrency) return owes;
    const rate = Number(rateOf(currency));
    return rate > 0 ? (Math.ceil((Number(owes) / rate) * 100) / 100).toFixed(2) : '';
  }, [owes, currency, defaultCurrency]);
  useEffect(() => setAmount(dueIn), [dueIn]);

  const add = (
    method: PaymentMethod,
    value = amount,
    cur = method === 'CASH' ? currency : defaultCurrency,
  ) => {
    if (!isMoney(value) || Number(value) <= 0) return;
    setTenders((list) => [
      ...list,
      {
        method,
        currency: cur,
        amount: Number(value).toFixed(2),
        rate: rateOf(cur),
        reference: reference || undefined,
      },
    ]);
    setReference('');
    setError(null);
  };

  const credit = customer ? Number(customer.credit) : 0;
  const problems = (() => {
    if (cart.cart.lines.length === 0) return t('pos.emptyCart');
    if ((mode === 'HELD' || compareMoney(owes, 0) > 0) && !customer) return t('pos.needsCustomer');
    if (
      compareMoney(over, 0) > 0 &&
      overpayment === 'CHANGE' &&
      compareMoney(cashTendered, over) < 0
    )
      return t('errors.OVERPAID_NON_CASH');
    if (compareMoney(over, 0) > 0 && overpayment === 'CREDIT' && !customer)
      return t('pos.needsCustomer');
    return null;
  })();

  const submit = async (confirmDuplicate = false) => {
    setError(null);
    try {
      const sale = await checkout.mutateAsync({
        idempotencyKey: cart.cart.idempotencyKey,
        shiftId,
        customerId: customer?.id ?? null,
        mode,
        lines: cart.cart.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        cartDiscount: cart.cart.cartDiscount,
        payments: tenders.map((p) => ({
          method: p.method,
          currency: p.currency,
          amount: p.amount,
          rate: p.currency === defaultCurrency ? undefined : p.rate,
          reference: p.reference,
        })),
        overpayment,
        confirmDuplicate,
        note: cart.cart.note || undefined,
      });
      onDone(sale);
    } catch (e) {
      if (!(e instanceof ApiError)) return setError(errorMessage(e));
      const details = e.details as { items?: { itemId: string; price?: string }[] } | undefined;
      if (e.code === 'POSSIBLE_DUPLICATE') {
        modals.openConfirmModal({
          title: t('pos.duplicateTitle'),
          children: <Text size="sm">{t('pos.duplicateConfirm')}</Text>,
          labels: { confirm: t('pos.saveAgain'), cancel: t('common.cancel') },
          onConfirm: () => void submit(true),
        });
        return;
      }
      if (
        e.code === 'PRICE_CHANGED' ||
        e.code === 'STOCK_INSUFFICIENT' ||
        e.code === 'ITEM_NOT_SELLABLE'
      ) {
        const problem =
          e.code === 'PRICE_CHANGED'
            ? 'PRICE'
            : e.code === 'STOCK_INSUFFICIENT'
              ? 'STOCK'
              : 'NOT_SELLABLE';
        const items = (details?.items ?? []).map((i) =>
          typeof i === 'string' ? { itemId: i } : i,
        );
        cart.markProblems(items.map((i) => ({ itemId: i.itemId, problem, price: i.price })));
        onClose();
      }
      setError(errorMessage(e));
    }
  };

  const methods: { key: PaymentMethod; label: string; disabled?: boolean }[] = [
    { key: 'CASH', label: t('sales.method.CASH') },
    { key: 'CARD', label: t('sales.method.CARD') },
    { key: 'BANK_TRANSFER', label: t('sales.method.BANK_TRANSFER') },
    { key: 'STORE_CREDIT', label: t('sales.method.STORE_CREDIT'), disabled: credit <= 0 },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('pos.pay')}
      centered
      size="lg"
      fullScreen={phone}
    >
      <Stack gap="md">
        <div>
          <div className={classes.payTotal}>{money(total)}</div>
          {Number(cart.cart.cartDiscount) > 0 && (
            <Text ta="center" size="sm" c="dimmed">
              {t('pos.afterDiscount')}
            </Text>
          )}
        </div>
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(v) => setMode(v as 'TAKEN' | 'HELD')}
          data={[
            { value: 'TAKEN', label: t('pos.taken') },
            { value: 'HELD', label: t('pos.held') },
          ]}
        />
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <MoneyInput
            label={t('pos.amount')}
            value={amount}
            onChange={setAmount}
            style={{ flex: 1 }}
            size="md"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (amount) add('CASH');
                else void submit();
              }
            }}
          />
          {active.length > 1 && (
            <Select
              aria-label={t('pos.currency')}
              w={100}
              size="md"
              value={currency}
              onChange={(v) => v && setCurrency(v)}
              data={active.map((c) => c.code)}
              allowDeselect={false}
            />
          )}
        </Group>
        {currency !== defaultCurrency && (
          <Text size="xs" c="dimmed">
            {t('pos.rateNote', { code: currency, rate: rateOf(currency), base: defaultCurrency })}
          </Text>
        )}
        <div className={classes.quick}>
          {dueIn && (
            <Button variant="light" onClick={() => add('CASH', dueIn)}>
              {t('pos.exact')}
            </Button>
          )}
          {currency === defaultCurrency &&
            quickAmounts(owes).map((q) => (
              <Button key={q} variant="default" onClick={() => add('CASH', q)}>
                {formatMoney(q, currency, i18n.language)}
              </Button>
            ))}
        </div>
        <div className={classes.methods}>
          {methods.map((m) => (
            <Button
              key={m.key}
              size="md"
              variant={m.key === 'CASH' ? 'filled' : 'light'}
              disabled={m.disabled || !amount}
              onClick={() =>
                add(
                  m.key,
                  m.key === 'STORE_CREDIT' ? Math.min(Number(amount), credit).toFixed(2) : amount,
                )
              }
            >
              {m.label}
            </Button>
          ))}
        </div>
        <TextInput
          size="xs"
          label={t('pos.reference')}
          placeholder={t('pos.referenceHint')}
          value={reference}
          onChange={(e) => setReference(e.currentTarget.value)}
        />
        {tenders.length > 0 && (
          <Stack gap={4}>
            {tenders.map((p, i) => (
              <Group key={i} justify="space-between">
                <Text>
                  {t(`sales.method.${p.method}`)}
                  {p.reference ? ` · ${p.reference}` : ''}
                </Text>
                <Group gap={6}>
                  <Text fw={600}>{formatMoney(p.amount, p.currency, i18n.language)}</Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t('common.remove')}
                    onClick={() => setTenders((list) => list.filter((_, j) => j !== i))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
        {compareMoney(owes, 0) > 0 && (
          <div className={classes.owes} style={{ color: 'var(--mantine-color-red-7)' }}>
            {tenders.length === 0 && mode === 'TAKEN'
              ? t('pos.nothingPaid', { amount: money(owes) })
              : mode === 'HELD'
                ? t('pos.heldRest', { amount: money(owes) })
                : t('pos.customerOwes', { amount: money(owes) })}
          </div>
        )}
        {compareMoney(over, 0) > 0 && (
          <Stack gap={6}>
            <div className={classes.owes} style={{ color: 'var(--mantine-color-green-8)' }}>
              {overpayment === 'CHANGE'
                ? t('pos.giveChange', { amount: money(over) })
                : t('pos.keepCredit', { amount: money(over) })}
            </div>
            {customer && (
              <SegmentedControl
                size="xs"
                value={overpayment}
                onChange={(v) => setOverpayment(v as 'CHANGE' | 'CREDIT')}
                data={[
                  { value: 'CHANGE', label: t('pos.changeOption') },
                  { value: 'CREDIT', label: t('pos.creditOption') },
                ]}
              />
            )}
          </Stack>
        )}
        {(error || problems) && (
          <Alert color={error ? 'red' : 'yellow'} variant="light">
            {error ?? problems}
          </Alert>
        )}
        <Button
          size="lg"
          onClick={() => void submit()}
          loading={checkout.isPending}
          disabled={Boolean(problems)}
        >
          {t('pos.complete')}
        </Button>
      </Stack>
    </Modal>
  );
}
