import { Modal, TextInput, Text, Group, UnstyledButton, Loader, Center, Badge, Box, Image, Stack } from '@mantine/core'
import { IconSearch, IconPhoto, IconPackage } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '@/api/client'
import type { Product, Variant } from '@/types'
import { useCurrency } from '@/hooks/useCurrency'

interface Props {
  opened: boolean
  onClose: () => void
  onPick: (product: Product, variant: Variant) => void
  currencyCode?: string
}

export function SearchModal({ opened, onClose, onPick, currencyCode }: Props) {
  const { t } = useTranslation()
  const { format } = useCurrency(currencyCode)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const r = await api.searchProducts(q)
      setResults(r)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setQuery('')
    setResults([])
    onClose()
  }

  const items = results.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v }))
  )

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconSearch size={18} />
          <Text fw={700} size="md">{t('search.title')}</Text>
        </Group>
      }
      size="xl"
      centered
      styles={{
        header: { borderBottom: '1px solid var(--mantine-color-gray-2)', paddingBottom: 12 },
        body: { padding: 0 },
      }}
    >
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <TextInput
          leftSection={<IconSearch size={18} />}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => handleSearch(e.currentTarget.value)}
          size="lg"
          radius="md"
          data-autofocus
          styles={{ input: { fontWeight: 500 } }}
        />
      </Box>

      <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {loading && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Loader size="md" />
              <Text size="sm" c="dimmed">Searching…</Text>
            </Stack>
          </Center>
        )}

        {!loading && query.length >= 2 && items.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconPackage size={40} color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" fw={500}>{t('search.noResults')}</Text>
              <Text size="xs" c="dimmed">Try a different keyword or SKU</Text>
            </Stack>
          </Center>
        )}

        {!loading && query.length < 2 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconSearch size={40} color="var(--mantine-color-gray-3)" />
              <Text c="dimmed" size="sm">Type at least 2 characters to search</Text>
            </Stack>
          </Center>
        )}

        {!loading && items.length > 0 && (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              padding: 16,
            }}
          >
            {items.map(({ product, variant }) => {
              const price = api.getVariantPrice(variant)
              const variantLabel = variant.title && variant.title !== 'Default Title'
                ? variant.title
                : variant.sku || ''

              return (
                <UnstyledButton
                  key={variant.id}
                  onClick={() => { onPick(product, variant); handleClose() }}
                  style={{ width: '100%' }}
                >
                  <Box
                    style={{
                      border: '1.5px solid var(--mantine-color-gray-2)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: 'var(--mantine-color-white)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'var(--mantine-color-blue-4)'
                      el.style.boxShadow = '0 4px 16px rgba(34,139,230,0.15)'
                      el.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.borderColor = 'var(--mantine-color-gray-2)'
                      el.style.boxShadow = 'none'
                      el.style.transform = 'translateY(0)'
                    }}
                  >
                    <Box style={{ position: 'relative', aspectRatio: '1', background: 'var(--mantine-color-gray-0)', overflow: 'hidden' }}>
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt={product.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <Center h="100%">
                          <IconPhoto size={36} color="var(--mantine-color-gray-4)" />
                        </Center>
                      )}
                    </Box>

                    <Box p="xs">
                      <Text fw={600} size="sm" lineClamp={2} lh={1.3} mb={4}>
                        {product.title}
                      </Text>
                      {variantLabel && (
                        <Badge variant="light" size="xs" color="gray" mb={6}>
                          {variantLabel}
                        </Badge>
                      )}
                      <Text fw={800} size="sm" c="blue.7">
                        {format(price)}
                      </Text>
                    </Box>
                  </Box>
                </UnstyledButton>
              )
            })}
          </Box>
        )}
      </Box>
    </Modal>
  )
}
