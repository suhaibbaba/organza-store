import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  addMoney,
  CASH_PLACES,
  EXPENSE_CATEGORIES,
  fromMinor,
  multiplyMoney,
  type ShiftView as Shift,
  toMinor,
} from '@organza/shared';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalculator,
  IconLock,
  IconReceipt2,
  IconSignature,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@web/modules/auth/session';
import { useMoney } from '@web/modules/catalogue/components';
import { useCurrencies } from '@web/modules/settings/api';
import { isMoney, MoneyInput } from '@web/shared/components/MoneyInput';
import { useErrorMessage } from '@web/shared/hooks/use-error-message';
import { ApiError } from '@web/shared/lib/api-client';
import { formatDateTime, formatMoney } from '@web/shared/lib/format';
import { type CountInput, useShiftMutations } from './api';
import classes from './sales.module.css';

export const SHIFT_COLORS = {
  OPEN: 'green',
  LEFT_OPEN: 'orange',
  COUNTED: 'blue',
  CLOSED: 'gray',
} as const;

/** Notes and coins per currency for the count; other currencies are counted as one amount. */
const DENOMINATIONS: Record<string, string[]> = {
  ILS: ['200', '100', '50', '20', '10', '5', '2', '1', '0.50', '0.10'],
  USD: ['100', '50', '20', '10', '5', '1'],
  EUR: ['500', '200', '100', '50', '20', '10', '5', '2', '1'],
  JOD: ['50', '20', '10', '5', '1', '0.50'],
};

/** A shift with everything the person may see: the expected cash only after the blind count. */
export function ShiftPanel({ shift }: { shift: Shift }) {
  const { t, i18n } = useTranslation();
  const { can, user } = useSession();
  const [dialog, setDialog] = useState<
    null | 'movement' | 'count' | 'recount' | 'close' | 'signOff'
  >(null);
  const money = useMoney();
  const lang = i18n.language;
  const mine = shift.openedBy.id === user?.id;
  const operate = can('shifts.operate') && (mine || can('shifts.closeOthers'));

  return (
    <Stack gap="md">
      <Card withBorder>
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap={6}>
              <Text fw={700} dir="ltr">
                {shift.number}
              </Text>
              <Badge color={SHIFT_COLORS[shift.status]} variant="light">
                {t(`shifts.status.${shift.status}`)}
              </Badge>
              {shift.hasDifference && (
                <Badge color="red" variant="light">
                  {t('shifts.difference')}
                </Badge>
              )}
              {shift.imported && (
                <Badge color="gray" variant="outline">
                  {t('sales.imported')}
                </Badge>
              )}
              {shift.signedOffAt && (
                <Badge color="teal" variant="light">
                  {t('shifts.signedOff')}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {shift.register.name} · {shift.openedBy.name} · {formatDateTime(shift.openedAt, lang)}
              {shift.closedAt ? ` → ${formatDateTime(shift.closedAt, lang)}` : ''}
            </Text>
            <Text size="sm">
              {t('shifts.float')}:{' '}
              {shift.float.length
                ? shift.float.map((f) => formatMoney(f.amount, f.currency, lang)).join(' + ')
                : money('0')}
            </Text>
          </Stack>
          <Group gap="xs">
            {shift.status === 'OPEN' && (can('cash.paidInOut') || can('cash.expense')) && (
              <Button
                variant="default"
                leftSection={<IconReceipt2 size={16} />}
                onClick={() => setDialog('movement')}
              >
                {t('shifts.cashMovement')}
              </Button>
            )}
            {(shift.status === 'OPEN' || shift.status === 'LEFT_OPEN') && operate && (
              <Button leftSection={<IconCalculator size={16} />} onClick={() => setDialog('count')}>
                {t('shifts.count')}
              </Button>
            )}
            {shift.status === 'COUNTED' && can('shifts.recount') && (
              <Button variant="default" onClick={() => setDialog('recount')}>
                {t('shifts.recount')}
              </Button>
            )}
            {shift.status === 'COUNTED' && operate && (
              <Button leftSection={<IconLock size={16} />} onClick={() => setDialog('close')}>
                {t('shifts.close')}
              </Button>
            )}
            {shift.status === 'CLOSED' &&
              !shift.signedOffAt &&
              !shift.imported &&
              can('shifts.signOff') && (
                <Button
                  variant="light"
                  leftSection={<IconSignature size={16} />}
                  onClick={() => setDialog('signOff')}
                >
                  {t('shifts.signOff')}
                </Button>
              )}
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label={t('shifts.salesCount')} value={String(shift.totals.sales)} />
        <Stat
          label={t('shifts.salesTotal')}
          value={
            shift.totals.salesTotal === null
              ? t('shifts.afterCount')
              : money(shift.totals.salesTotal)
          }
        />
        {shift.totals.byMethod.map((m) => (
          <Stat key={m.method} label={t(`sales.method.${m.method}`)} value={money(m.amount)} />
        ))}
      </SimpleGrid>

      {shift.reconciliation ? (
        <Card withBorder>
          <Text fw={600} mb="xs">
            {t('shifts.reconciliation')}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: shift.reconciliation.length > 1 ? 2 : 1 }}>
            {shift.reconciliation.map((r) => {
              const diff = r.difference === null ? null : Number(r.difference);
              return (
                <Stack key={r.currency} gap={2}>
                  <Text fw={600}>{r.currency}</Text>
                  {r.lines.map((l) => (
                    <div key={l.kind} className={classes.reconLine}>
                      <Text size="sm">
                        {t(`shifts.line.${l.kind}`)} {l.count > 1 ? `(${l.count})` : ''}
                      </Text>
                      <Text size="sm">{formatMoney(l.amount, r.currency, lang)}</Text>
                    </div>
                  ))}
                  <div className={classes.reconLine}>
                    <Text fw={600}>{t('shifts.expected')}</Text>
                    <Text fw={600}>{formatMoney(r.expected, r.currency, lang)}</Text>
                  </div>
                  <div className={classes.reconLine}>
                    <Text fw={600}>{t('shifts.counted')}</Text>
                    <Text fw={600}>
                      {r.counted === null ? '—' : formatMoney(r.counted, r.currency, lang)}
                    </Text>
                  </div>
                  {diff !== null && (
                    <div className={classes.reconLine}>
                      <Text fw={700} c={diff === 0 ? 'green.8' : 'red.7'}>
                        {diff === 0
                          ? t('shifts.balanced')
                          : diff > 0
                            ? t('shifts.over')
                            : t('shifts.short')}
                      </Text>
                      <Text fw={700} c={diff === 0 ? 'green.8' : 'red.7'}>
                        {formatMoney(String(Math.abs(diff)), r.currency, lang)}
                      </Text>
                    </div>
                  )}
                </Stack>
              );
            })}
          </SimpleGrid>
          {shift.closeNote && (
            <Text size="sm" mt="sm">
              {t('shifts.closeNote')}: {shift.closeNote}
            </Text>
          )}
          {shift.signOffNote && (
            <Text size="sm">
              {t('shifts.signOffNote')}: {shift.signOffNote}
            </Text>
          )}
        </Card>
      ) : (
        <Alert variant="light" color="blue">
          {t('shifts.blindHint')}
        </Alert>
      )}

      <Card withBorder>
        <Text fw={600} mb="xs">
          {t('shifts.movements')}
        </Text>
        {shift.movements.length === 0 && (
          <Text size="sm" c="dimmed">
            {t('shifts.noMovements')}
          </Text>
        )}
        <Stack gap={4}>
          {shift.movements.map((m) => (
            <Group key={m.id} justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                {m.type === 'PAID_IN' ? (
                  <IconArrowDown size={16} color="green" />
                ) : (
                  <IconArrowUp size={16} color="red" />
                )}
                <Text size="sm" truncate td={m.reversed ? 'line-through' : undefined}>
                  {t(`shifts.movement.${m.type}`)} ·{' '}
                  {m.type === 'EXPENSE'
                    ? t(`shifts.expense.${m.counterpart}`)
                    : t(`shifts.place.${m.counterpart}`)}
                  {m.note ? ` · ${m.note}` : ''} · {m.createdBy}
                </Text>
              </Group>
              <Text size="sm" fw={600}>
                {formatMoney(m.amount, m.currency, lang)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>

      {dialog === 'movement' && <MovementDialog shift={shift} onClose={() => setDialog(null)} />}
      {(dialog === 'count' || dialog === 'recount') && (
        <CountDialog shift={shift} recount={dialog === 'recount'} onClose={() => setDialog(null)} />
      )}
      {dialog === 'close' && <CloseDialog shift={shift} onClose={() => setDialog(null)} />}
      {dialog === 'signOff' && <SignOffDialog shift={shift} onClose={() => setDialog(null)} />}
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Card>
  );
}

function useCashCurrencies(shift: Shift) {
  const currencies = useCurrencies();
  const list = (currencies.data ?? []).filter((c) => c.isActive && (c.isDefault || c.rateSetAt));
  const defaultCode = list.find((c) => c.isDefault)?.code;
  // The default currency first, then any currency already in the drawer.
  const codes = new Set<string>(defaultCode ? [defaultCode] : []);
  for (const f of shift.float) codes.add(f.currency);
  for (const r of shift.reconciliation ?? []) codes.add(r.currency);
  for (const c of list) codes.add(c.code);
  return { codes: [...codes], defaultCode: defaultCode ?? 'ILS' };
}

function MovementDialog({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useSession();
  const errorMessage = useErrorMessage();
  const { movement } = useShiftMutations();
  const { codes, defaultCode } = useCashCurrencies(shift);
  const [type, setType] = useState<'PAID_IN' | 'DROP' | 'EXPENSE'>(
    can('cash.paidInOut') ? 'DROP' : 'EXPENSE',
  );
  const [currency, setCurrency] = useState(defaultCode);
  const [amount, setAmount] = useState('');
  const [counterpart, setCounterpart] = useState<string>('SAFE');
  const [note, setNote] = useState('');
  useEffect(() => setCounterpart(type === 'EXPENSE' ? 'SUPPLIES' : 'SAFE'), [type]);

  const submit = async () => {
    try {
      await movement.mutateAsync({
        id: shift.id,
        type,
        currency,
        amount: Number(amount).toFixed(2),
        counterpart,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('shifts.cashMovement')} centered>
      <Stack>
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v as typeof type)}
          data={[
            { value: 'DROP', label: t('shifts.movement.DROP'), disabled: !can('cash.paidInOut') },
            {
              value: 'PAID_IN',
              label: t('shifts.movement.PAID_IN'),
              disabled: !can('cash.paidInOut'),
            },
            {
              value: 'EXPENSE',
              label: t('shifts.movement.EXPENSE'),
              disabled: !can('cash.expense'),
            },
          ]}
        />
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <MoneyInput
            data-autofocus
            label={t('pos.amount')}
            value={amount}
            onChange={setAmount}
            style={{ flex: 1 }}
          />
          {codes.length > 1 && (
            <Select
              w={100}
              value={currency}
              onChange={(v) => v && setCurrency(v)}
              data={codes}
              allowDeselect={false}
            />
          )}
        </Group>
        <Select
          label={
            type === 'EXPENSE'
              ? t('shifts.category')
              : type === 'DROP'
                ? t('shifts.to')
                : t('shifts.from')
          }
          value={counterpart}
          onChange={(v) => v && setCounterpart(v)}
          allowDeselect={false}
          data={
            type === 'EXPENSE'
              ? EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`shifts.expense.${c}`) }))
              : CASH_PLACES.map((c) => ({ value: c, label: t(`shifts.place.${c}`) }))
          }
        />
        <Textarea
          label={t('shifts.note')}
          required={type === 'EXPENSE'}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void submit()}
            loading={movement.isPending}
            disabled={
              !isMoney(amount) || Number(amount) <= 0 || (type === 'EXPENSE' && !note.trim())
            }
          >
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** The blind count: notes and coins per currency, or one amount; final once saved. */
function CountDialog({
  shift,
  recount,
  onClose,
}: {
  shift: Shift;
  recount: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const m = useShiftMutations();
  const { codes } = useCashCurrencies(shift);
  const [pieces, setPieces] = useState<Record<string, Record<string, number>>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const totalOf = (code: string): string => {
    const denoms = DENOMINATIONS[code];
    const counted = pieces[code];
    if (denoms && counted && Object.values(counted).some((n) => n > 0))
      return addMoney('0', ...Object.entries(counted).map(([d, n]) => multiplyMoney(d, n)));
    return isMoney(amounts[code] ?? '') ? Number(amounts[code]).toFixed(2) : '0.00';
  };

  const submit = async () => {
    const counts: CountInput[] = codes.map((code) => {
      const counted = pieces[code];
      const withPieces = counted && Object.values(counted).some((n) => n > 0);
      return {
        currency: code,
        amount: totalOf(code),
        denominations: withPieces
          ? Object.fromEntries(Object.entries(counted).filter(([, n]) => n > 0))
          : undefined,
      };
    });
    try {
      await (recount ? m.recount : m.count).mutateAsync({
        id: shift.id,
        counts,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={recount ? t('shifts.recount') : t('shifts.count')}
      centered
      size="lg"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t('shifts.countHint')}
        </Text>
        {codes.map((code) => {
          const denoms = DENOMINATIONS[code];
          return (
            <Card key={code} withBorder padding="sm">
              <Group justify="space-between" mb="xs">
                <Text fw={700}>{code}</Text>
                <Text fw={700}>{formatMoney(totalOf(code), code, i18n.language)}</Text>
              </Group>
              {denoms ? (
                <div className={classes.denominations}>
                  {denoms.map((d) => (
                    <NumberInput
                      key={d}
                      label={`${d} ×`}
                      min={0}
                      allowDecimal={false}
                      size="xs"
                      value={pieces[code]?.[d] ?? ''}
                      onChange={(v) =>
                        setPieces((p) => ({ ...p, [code]: { ...p[code], [d]: Number(v) || 0 } }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <MoneyInput
                  value={amounts[code] ?? ''}
                  onChange={(v) => setAmounts((a) => ({ ...a, [code]: v }))}
                />
              )}
              {denoms && (
                <MoneyInput
                  mt="xs"
                  size="xs"
                  label={t('shifts.orTotal')}
                  value={amounts[code] ?? ''}
                  disabled={Object.values(pieces[code] ?? {}).some((n) => n > 0)}
                  onChange={(v) => setAmounts((a) => ({ ...a, [code]: v }))}
                />
              )}
            </Card>
          );
        })}
        {recount && (
          <Textarea
            label={t('shifts.note')}
            required
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
        )}
        <Alert color="orange" variant="light">
          {t('shifts.countFinal')}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void submit()}
            loading={m.count.isPending || m.recount.isPending}
            disabled={recount && !note.trim()}
          >
            {t('shifts.saveCount')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Close: cash taken out (to the safe or bank) per currency; what stays is the next float. */
function CloseDialog({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const errorMessage = useErrorMessage();
  const { close } = useShiftMutations();
  const recon = shift.reconciliation ?? [];
  const [drops, setDrops] = useState<Record<string, string>>({});
  const [to, setTo] = useState<'SAFE' | 'BANK'>('SAFE');
  const [note, setNote] = useState('');
  const [needsNote, setNeedsNote] = useState(shift.hasDifference);

  const submit = async () => {
    try {
      await close.mutateAsync({
        id: shift.id,
        drops: Object.entries(drops)
          .filter(([, v]) => isMoney(v) && Number(v) > 0)
          .map(([currency, amount]) => ({ currency, amount: Number(amount).toFixed(2), to })),
        note: note.trim() || undefined,
      });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOTE_REQUIRED') setNeedsNote(true);
      notifications.show({ color: 'red', message: errorMessage(e) });
    }
  };

  return (
    <Modal opened onClose={onClose} title={t('shifts.close')} centered>
      <Stack>
        <Text size="sm" c="dimmed">
          {t('shifts.closeHint')}
        </Text>
        <SegmentedControl
          value={to}
          onChange={(v) => setTo(v as 'SAFE' | 'BANK')}
          data={CASH_PLACES.map((p) => ({ value: p, label: t(`shifts.place.${p}`) }))}
        />
        {recon.map((r) => {
          const counted = r.counted ?? '0.00';
          const drop = isMoney(drops[r.currency] ?? '') ? drops[r.currency]! : '0';
          const stays = addMoney(counted, fromMinor(-toMinor(drop)));
          return (
            <Stack key={r.currency} gap={2}>
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <MoneyInput
                  label={t('shifts.takeOut', { code: r.currency })}
                  value={drops[r.currency] ?? ''}
                  onChange={(v) => setDrops((d) => ({ ...d, [r.currency]: v }))}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="default"
                  onClick={() => setDrops((d) => ({ ...d, [r.currency]: counted }))}
                >
                  {t('shifts.all')}
                </Button>
              </Group>
              <Text size="xs" c={Number(stays) < 0 ? 'red' : 'dimmed'}>
                {t('shifts.staysInDrawer', {
                  amount: formatMoney(stays, r.currency, i18n.language),
                })}
              </Text>
            </Stack>
          );
        })}
        {needsNote && (
          <Textarea
            label={t('shifts.differenceNote')}
            required
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void submit()}
            loading={close.isPending}
            disabled={needsNote && !note.trim()}
          >
            {t('shifts.close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function SignOffDialog({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { signOff } = useShiftMutations();
  const [note, setNote] = useState('');
  return (
    <Modal opened onClose={onClose} title={t('shifts.signOff')} centered>
      <Stack>
        <Textarea
          data-autofocus
          label={t('shifts.signOffNote')}
          required
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={signOff.isPending}
            disabled={!note.trim()}
            onClick={() =>
              signOff.mutate(
                { id: shift.id, note: note.trim() },
                {
                  onSuccess: onClose,
                  onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
                },
              )
            }
          >
            {t('shifts.signOff')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
