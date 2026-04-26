import { Stack, Title, Group, Text, NumberInput, SegmentedControl, Button, Divider } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '@/hooks/useCurrency'

interface Props {
  currencyCode?: string
  subtotal: number
  cartDiscountValue: number
  cartDiscountType: 'fixed' | 'percent'
  cartDiscountAmount: number
  total: number
  paymentMethod: string
  canCheckout: boolean
  processing: boolean
  onCartDiscountChange: (value: number, type: 'fixed' | 'percent') => void
  onPaymentChange: (method: string) => void
  onCheckout: () => void
  onClear: () => void
  cartLength: number
}

export function SummaryPanel({
  currencyCode,
  subtotal,
  cartDiscountValue,
  cartDiscountType,
  cartDiscountAmount,
  total,
  paymentMethod,
  canCheckout,
  processing,
  onCartDiscountChange,
  onPaymentChange,
  onCheckout,
  onClear,
  cartLength,
}: Props) {
  const { t } = useTranslation()
  const { format } = useCurrency(currencyCode)

  return (
    <Stack gap="md" p="md" style={{ height: '100%', overflow: 'auto' }}>
      <Title order={3}>{t('summary.title')}</Title>

      <Group justify="space-between">
        <Text>{t('summary.subtotal')}</Text>
        <Text>{format(subtotal)}</Text>
      </Group>

      <Divider />

      <Stack gap={6}>
        <Text size="sm" c="dimmed">{t('summary.cartDiscount')}</Text>
        <Group gap="xs" wrap="nowrap">
          <NumberInput
            value={cartDiscountValue || ''}
            onChange={(v) => onCartDiscountChange(Number(v) || 0, cartDiscountType)}
            min={0}
            placeholder="0"
            style={{ flex: 1 }}
            hideControls
          />
          <SegmentedControl
            value={cartDiscountType}
            onChange={(v) => onCartDiscountChange(cartDiscountValue, v as 'fixed' | 'percent')}
            data={[
              { label: t('pos.fixed'), value: 'fixed' },
              { label: t('pos.percent'), value: 'percent' },
            ]}
          />
        </Group>
        {cartDiscountAmount > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">− {t('summary.discountApplied')}</Text>
            <Text size="sm" c="red">−{format(cartDiscountAmount)}</Text>
          </Group>
        )}
      </Stack>

      <Divider size="md" />

      <Group justify="space-between">
        <Title order={3}>{t('summary.total')}</Title>
        <Title order={2}>{format(total)}</Title>
      </Group>

      <Divider />

      <Stack gap={6}>
        <Text size="sm" c="dimmed">{t('summary.paymentMethod')}</Text>
        <SegmentedControl
          fullWidth
          value={paymentMethod}
          onChange={onPaymentChange}
          data={[
            { label: t('summary.cash'), value: 'cash' },
            { label: t('summary.card'), value: 'card' },
            { label: t('summary.other'), value: 'other' },
          ]}
        />
      </Stack>

      <Button
        size="lg"
        onClick={onCheckout}
        disabled={!canCheckout || processing}
        loading={processing}
      >
        {processing ? t('summary.processing') : `${t('summary.complete')} · ${format(total)}`}
      </Button>

      {cartLength > 0 && (
        <Button variant="subtle" color="red" onClick={onClear}>
          {t('summary.clear')}
        </Button>
      )}
    </Stack>
  )
}
