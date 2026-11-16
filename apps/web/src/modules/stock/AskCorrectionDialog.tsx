import { NumberInput, Select, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AskApprovalDialog } from '@web/modules/sales/AskApprovalDialog';
import { newIdempotencyKey } from '@web/shared/lib/api-client';

type Reason = 'DAMAGE' | 'LOSS' | 'FOUND' | 'COUNT_ADJUSTMENT';
const OUT: Reason[] = ['DAMAGE', 'LOSS'];

/** An employee reports a stock problem; a manager approves the correction (proposal C12). */
export function AskCorrectionDialog({
  item,
  onClose,
}: {
  item: { itemId: string; name: string; onHand: number } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<Reason>('COUNT_ADJUSTMENT');
  const [amount, setAmount] = useState<number>(item?.onHand ?? 0);
  const [key] = useState(newIdempotencyKey);
  const counted = reason === 'COUNT_ADJUSTMENT';
  const line = item
    ? counted
      ? { itemId: item.itemId, counted: amount }
      : { itemId: item.itemId, delta: OUT.includes(reason) ? -amount : amount }
    : { itemId: '', delta: 0 };
  return (
    <AskApprovalDialog
      opened={Boolean(item)}
      title={t('stock.askCorrection')}
      request={{
        kind: 'STOCK_ADJUSTMENT',
        adjustment: { idempotencyKey: key, reason, lines: [line] },
      }}
      onClose={onClose}
    >
      <Text className="ds-bold">{item?.name}</Text>
      <Select
        label={t('stock.reasonLabel')}
        allowDeselect={false}
        value={reason}
        onChange={(v) => setReason((v as Reason) ?? 'COUNT_ADJUSTMENT')}
        data={(['COUNT_ADJUSTMENT', 'DAMAGE', 'LOSS', 'FOUND'] as const).map((r) => ({
          value: r,
          label: t(`stock.reason.${r}`),
        }))}
      />
      <NumberInput
        label={counted ? t('stock.countedOnShelf') : t('stock.howMany')}
        description={counted ? t('stock.recorded', { count: item?.onHand ?? 0 }) : undefined}
        min={0}
        max={10000}
        allowDecimal={false}
        value={amount}
        onChange={(v) => setAmount(Math.max(0, Number(v) || 0))}
      />
    </AskApprovalDialog>
  );
}
