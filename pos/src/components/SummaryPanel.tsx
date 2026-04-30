import { Stack, Title, Group, Text, NumberInput, SegmentedControl, Button, Divider, Box, Badge } from '@mantine/core'
import { IconShoppingBag, IconCreditCard, IconCash, IconReceipt2, IconTrash } from '@tabler/icons-react'
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

  const paymentIcons: Record<string, React.ReactNode> = {
    cash: <IconCash size={16} />,
    card: <IconCreditCard size={16} />,
    other: <IconReceipt2 size={16} />,
  }

  return (
    <Stack gap={0} style={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box
        p="md"
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          background: 'var(--mantine-color-white)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconShoppingBag size={20} />
            <Title order={4}>{t('summary.title')}</Title>
          </Group>
          {cartLength > 0 && (
            <Badge variant="filled" size="lg" color="blue" circle>{cartLength}</Badge>
          )}
        </Group>
      </Box>

      <Stack gap="md" p="md" style={{ flex: 1 }}>
        {/* Subtotal */}
        <Group justify="space-between" py={4}>
          <Text c="dimmed" size="sm">{t('summary.subtotal')}</Text>
          <Text fw={500}>{format(subtotal)}</Text>
        </Group>

        {/* Cart discount */}
        <Box>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>
            {t('summary.cartDiscount')}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <NumberInput
              value={cartDiscountValue || ''}
              onChange={(v) => onCartDiscountChange(Number(v) || 0, cartDiscountType)}
              min={0}
              placeholder="0"
              style={{ flex: 1 }}
              hideControls
              radius="md"
              size="sm"
            />
            <SegmentedControl
              value={cartDiscountType}
              onChange={(v) => onCartDiscountChange(cartDiscountValue, v as 'fixed' | 'percent')}
              data={[
                { label: t('pos.fixed'), value: 'fixed' },
                { label: t('pos.percent'), value: 'percent' },
              ]}
              size="sm"
            />
          </Group>
          {cartDiscountAmount > 0 && (
            <Group justify="space-between" mt={8}>
              <Text size="xs" c="dimmed">Discount applied</Text>
              <Text size="sm" fw={600} c="red">−{format(cartDiscountAmount)}</Text>
            </Group>
          )}
        </Box>

        <Divider />

        {/* Total */}
        <Box
          p="md"
          style={{
            background: 'var(--mantine-color-blue-0)',
            borderRadius: 12,
            border: '1px solid var(--mantine-color-blue-2)',
          }}
        >
          <Group justify="space-between" align="center">
            <Text fw={600} c="blue.8">{t('summary.total')}</Text>
            <Title order={2} c="blue.8">{format(total)}</Title>
          </Group>
        </Box>

        {/* Payment method */}
        <Box>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={8} style={{ letterSpacing: '0.05em' }}>
            {t('summary.paymentMethod')}
          </Text>
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {['cash', 'card', 'other'].map((method) => (
              <Box
                key={method}
                onClick={() => onPaymentChange(method)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: `2px solid ${paymentMethod === method ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-3)'}`,
                  background: paymentMethod === method ? 'var(--mantine-color-blue-0)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s',
                  color: paymentMethod === method ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-6)',
                }}
              >
                {paymentIcons[method]}
                <Text size="xs" fw={600} style={{ textTransform: 'capitalize', color: 'inherit' }}>
                  {t(`summary.${method}`)}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Stack>

      {/* Actions */}
      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', background: 'var(--mantine-color-white)' }}>
        <Stack gap="xs">
          <Button
            size="lg"
            radius="md"
            onClick={onCheckout}
            disabled={!canCheckout || processing}
            loading={processing}
            fullWidth
            styles={{
              root: { height: 52, fontSize: 16, fontWeight: 700 },
            }}
          >
            {processing ? t('summary.processing') : `${t('summary.complete')} · ${format(total)}`}
          </Button>

          {cartLength > 0 && (
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconTrash size={14} />}
              onClick={onClear}
              fullWidth
            >
              {t('summary.clear')}
            </Button>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
