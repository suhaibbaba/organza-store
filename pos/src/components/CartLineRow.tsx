import { Paper, Group, Stack, Text, ActionIcon, NumberInput, SegmentedControl } from '@mantine/core'
import { IconMinus, IconPlus, IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { CartLine as CartLineType } from '@/types'
import { useCurrency } from '@/hooks/useCurrency'

interface Props {
  item: CartLineType
  currencyCode?: string
  onQty: (variantId: string, delta: number) => void
  onRemove: (variantId: string) => void
  onDiscount: (variantId: string, value: number, type: 'fixed' | 'percent') => void
  lineTotal: number
}

export function CartLineRow({ item, currencyCode, onQty, onRemove, onDiscount, lineTotal }: Props) {
  const { t } = useTranslation()
  const { format } = useCurrency(currencyCode)
  const variantTitle = item.variant.title || item.variant.sku || ''

  return (
    <Paper p="sm" withBorder shadow="xs">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} truncate>{item.product.title}</Text>
            <Text size="xs" c="dimmed">{variantTitle}</Text>
            <Text size="xs" c="dimmed">{format(item.unitPrice)} {t('pos.unitPrice')}</Text>
          </div>
          <ActionIcon color="red" variant="subtle" onClick={() => onRemove(item.variant.id)}>
            <IconTrash size={18} />
          </ActionIcon>
        </Group>

        <Group justify="space-between" wrap="wrap" gap="xs">
          {/* Qty */}
          <Group gap={4} wrap="nowrap">
            <ActionIcon variant="default" onClick={() => onQty(item.variant.id, -1)}>
              <IconMinus size={14} />
            </ActionIcon>
            <Text fw={600} w={32} ta="center">{item.quantity}</Text>
            <ActionIcon variant="default" onClick={() => onQty(item.variant.id, 1)}>
              <IconPlus size={14} />
            </ActionIcon>
          </Group>

          {/* Discount */}
          <Group gap={4} wrap="nowrap">
            <NumberInput
              value={item.lineDiscount || ''}
              onChange={(v) => onDiscount(item.variant.id, Number(v) || 0, item.lineDiscountType)}
              min={0}
              w={70}
              size="xs"
              hideControls
              placeholder={t('pos.discount')}
            />
            <SegmentedControl
              size="xs"
              value={item.lineDiscountType}
              onChange={(v) => onDiscount(item.variant.id, item.lineDiscount, v as 'fixed' | 'percent')}
              data={[
                { label: t('pos.fixed'), value: 'fixed' },
                { label: t('pos.percent'), value: 'percent' },
              ]}
            />
          </Group>

          {/* Line total */}
          <Text fw={700} size="lg">{format(lineTotal)}</Text>
        </Group>
      </Stack>
    </Paper>
  )
}
