import { Group, Stack, Text, ActionIcon, NumberInput, SegmentedControl, Box, Badge } from '@mantine/core'
import { IconMinus, IconPlus, IconTrash, IconPhoto } from '@tabler/icons-react'
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
  const variantTitle = item.variant.title && item.variant.title !== 'Default Title'
    ? item.variant.title
    : item.variant.sku || ''

  return (
    <Box
      style={{
        border: '1px solid var(--mantine-color-gray-2)',
        borderRadius: 12,
        background: 'var(--mantine-color-white)',
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
      }}
    >
      <Group gap={0} wrap="nowrap" align="stretch">
        {/* Product thumbnail */}
        <Box
          style={{
            width: 72,
            minHeight: 72,
            flexShrink: 0,
            background: 'var(--mantine-color-gray-0)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {item.product.thumbnail ? (
            <img
              src={item.product.thumbnail}
              alt={item.product.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <Box style={{ height: '100%', minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconPhoto size={24} color="var(--mantine-color-gray-4)" />
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
          <Stack gap={8}>
            {/* Top row: title + price + remove */}
            <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} size="sm" truncate>{item.product.title}</Text>
                {variantTitle && (
                  <Badge variant="light" color="gray" size="xs" mt={2}>{variantTitle}</Badge>
                )}
              </Box>
              <Group gap={6} wrap="nowrap" align="center">
                <Text fw={700} size="md" c="dark" style={{ whiteSpace: 'nowrap' }}>
                  {format(lineTotal)}
                </Text>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={() => onRemove(item.variant.id)}
                  style={{ flexShrink: 0 }}
                >
                  <IconTrash size={15} />
                </ActionIcon>
              </Group>
            </Group>

            {/* Bottom row: qty + discount */}
            <Group justify="space-between" wrap="wrap" gap={8}>
              {/* Qty control */}
              <Group gap={0} wrap="nowrap" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, overflow: 'hidden' }}>
                <ActionIcon
                  variant="subtle"
                  size="md"
                  radius={0}
                  onClick={() => onQty(item.variant.id, -1)}
                  style={{ borderRight: '1px solid var(--mantine-color-gray-3)' }}
                >
                  <IconMinus size={13} />
                </ActionIcon>
                <Text fw={700} size="sm" w={36} ta="center" style={{ lineHeight: '30px' }}>
                  {item.quantity}
                </Text>
                <ActionIcon
                  variant="subtle"
                  size="md"
                  radius={0}
                  onClick={() => onQty(item.variant.id, 1)}
                  style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
                >
                  <IconPlus size={13} />
                </ActionIcon>
              </Group>

              {/* Unit price */}
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {format(item.unitPrice)} {t('pos.unitPrice')}
              </Text>

              {/* Discount */}
              <Group gap={4} wrap="nowrap">
                <NumberInput
                  value={item.lineDiscount || ''}
                  onChange={(v) => onDiscount(item.variant.id, Number(v) || 0, item.lineDiscountType)}
                  min={0}
                  w={64}
                  size="xs"
                  hideControls
                  placeholder={t('pos.discount')}
                  radius="md"
                  styles={{ input: { textAlign: 'center' } }}
                />
                <SegmentedControl
                  size="xs"
                  value={item.lineDiscountType}
                  onChange={(v) => onDiscount(item.variant.id, item.lineDiscount, v as 'fixed' | 'percent')}
                  data={[
                    { label: t('pos.fixed'), value: 'fixed' },
                    { label: t('pos.percent'), value: 'percent' },
                  ]}
                  style={{ flexShrink: 0 }}
                />
              </Group>
            </Group>
          </Stack>
        </Box>
      </Group>
    </Box>
  )
}
