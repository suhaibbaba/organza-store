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
import { StatCard, StatGrid } from '@web/shared/components/Widgets';
import c from './pages.module.css';
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
        <div className={c.headTop}>
          <div className={c.headTitle}>
            <h2 className={`${c.title} o-num`}>{shift.number}</h2>
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
          </div>
          <div className={c.actions}>
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
          </div>
        </div>
        <dl className={c.fields}>
          <div className={c.field}>
            <dt className={c.fieldLabel}>{t('pos.register')}</dt>
            <dd className={c.fieldValue}>{shift.register.name}</dd>
          </div>
          <div className={c.field}>
            <dt className={c.fieldLabel}>{t('nav.staff')}</dt>
            <dd className={c.fieldValue}>{shift.openedBy.name}</dd>
          </div>
          <div className={c.field}>
            <dt className={c.fieldLabel}>{t('common.date')}</dt>
            <dd className={c.fieldValue}>
              {formatDateTime(shift.openedAt, lang)}
              {shift.closedAt ? ` → ${formatDateTime(shift.closedAt, lang)}` : ''}
            </dd>
          </div>
          <div className={c.field}>
            <dt className={c.fieldLabel}>{t('shifts.float')}</dt>
            <dd className={c.fieldValue}>
              {shift.float.length
                ? shift.float.map((f) => formatMoney(f.amount, f.currency, lang)).join(' + ')
                : money('0')}
            </dd>
          </div>
        </dl>
      </Card>

      <StatGrid>
        <StatCard label={t('shifts.salesCount')} value={String(shift.totals.sales)} />
        <StatCard
          label={t('shifts.salesTotal')}
          value={
            shift.totals.salesTotal === null
              ? t('shifts.afterCount')
              : money(shift.totals.salesTotal)
          }
        />
        {shift.totals.byMethod.map((m) => (
          <StatCard key={m.method} label={t(`sales.method.${m.method}`)} value={money(m.amount)} />
        ))}
      </StatGrid>

      <div className={c.detail}>
        <div className={c.main}>
          <Card withBorder>
            <h3 className="ds-heading ds-mb-sm">{t('shifts.movements')}</h3>
            {shift.movements.length === 0 && (
              <Text size="sm" className="ds-muted">
                {t('shifts.noMovements')}
              </Text>
            )}
            <div>
              {shift.movements.map((m) => (
                <div key={m.id} className={c.entry}>
                  <Group gap={6} wrap="nowrap" className="ds-min-0">
                    {m.type === 'PAID_IN' ? (
                      <IconArrowDown size={16} className="ds-success ds-shrink-0" />
                    ) : (
                      <IconArrowUp size={16} className="ds-danger ds-shrink-0" />
                    )}
                    <Text size="sm" truncate className={m.reversed ? 'ds-strike' : undefined}>
                      {t(`shifts.movement.${m.type}`)} ·{' '}
                      {m.type === 'EXPENSE'
                        ? t(`shifts.expense.${m.counterpart}`)
                        : t(`shifts.place.${m.counterpart}`)}
                      {m.note ? ` · ${m.note}` : ''} · {m.createdBy}
                    </Text>
                  </Group>
                  <Text size="sm" className="ds-bold ds-nowrap">
                    {formatMoney(m.amount, m.currency, lang)}
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={c.side}>
          {shift.reconciliation ? (
            <Card withBorder>
              <h3 className="ds-heading ds-mb-sm">{t('shifts.reconciliation')}</h3>
              <Stack gap="md">
                {shift.reconciliation.map((r, _, all) => {
                  const diff = r.difference === null ? null : Number(r.difference);
                  const tone = diff === 0 ? 'ds-success' : 'ds-danger';
                  return (
                    <div key={r.currency} className={c.sum}>
                      {all.length > 1 && <span className="ds-eyebrow">{r.currency}</span>}
                      {r.lines.map((l) => (
                        <div key={l.kind} className={c.sumRow}>
                          <span>
                            {t(`shifts.line.${l.kind}`)} {l.count > 1 ? `(${l.count})` : ''}
                          </span>
                          <span>{formatMoney(l.amount, r.currency, lang)}</span>
                        </div>
                      ))}
                      <div className={`${c.sumRow} ${c.sumTotal}`}>
                        <span>{t('shifts.expected')}</span>
                        <span>{formatMoney(r.expected, r.currency, lang)}</span>
                      </div>
                      <div className={`${c.sumRow} ${c.sumStrong}`}>
                        <span>{t('shifts.counted')}</span>
                        <span>
                          {r.counted === null ? '—' : formatMoney(r.counted, r.currency, lang)}
                        </span>
                      </div>
                      {diff !== null && (
                        <div className={`${c.sumRow} ${c.sumStrong}`}>
                          <span className={tone}>
                            {diff === 0
                              ? t('shifts.balanced')
                              : diff > 0
                                ? t('shifts.over')
                                : t('shifts.short')}
                          </span>
                          <span className={tone}>
                            {formatMoney(String(Math.abs(diff)), r.currency, lang)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Stack>
              {shift.closeNote && (
                <Text size="sm" className="ds-mt-sm">
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
        </div>
      </div>

      {dialog === 'movement' && <MovementDialog shift={shift} onClose={() => setDialog(null)} />}
      {(dialog === 'count' || dialog === 'recount') && (
        <CountDialog shift={shift} recount={dialog === 'recount'} onClose={() => setDialog(null)} />
      )}
      {dialog === 'close' && <CloseDialog shift={shift} onClose={() => setDialog(null)} />}
      {dialog === 'signOff' && <SignOffDialog shift={shift} onClose={() => setDialog(null)} />}
    </Stack>
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
            className="ds-grow"
          />
          {codes.length > 1 && (
            <Select
              className={c.currency}
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
        <Text size="sm" className="ds-muted">
          {t('shifts.countHint')}
        </Text>
        {codes.map((code) => {
          const denoms = DENOMINATIONS[code];
          return (
            <Card key={code} withBorder padding="sm">
              <Group justify="space-between" className="ds-mb-xs">
                <Text className="ds-bold">{code}</Text>
                <Text className="ds-bold">{formatMoney(totalOf(code), code, i18n.language)}</Text>
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
                  className="ds-mt-xs"
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
        <Text size="sm" className="ds-muted">
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
                  className="ds-grow"
                />
                <Button
                  variant="default"
                  onClick={() => setDrops((d) => ({ ...d, [r.currency]: counted }))}
                >
                  {t('shifts.all')}
                </Button>
              </Group>
              <Text size="xs" className={Number(stays) < 0 ? 'ds-danger' : 'ds-muted'}>
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
