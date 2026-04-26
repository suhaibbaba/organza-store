import { Modal, TextInput, Stack, Text, Group, UnstyledButton, Paper, Loader, Center } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
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

  return (
    <Modal opened={opened} onClose={handleClose} title={t('search.title')} size="lg" centered>
      <Stack>
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => handleSearch(e.currentTarget.value)}
          size="md"
          data-autofocus
        />

        {loading && <Center><Loader size="sm" /></Center>}

        {!loading && query.length >= 2 && results.length === 0 && (
          <Text c="dimmed" ta="center">{t('search.noResults')}</Text>
        )}

        <Stack gap="xs" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {results.flatMap((p) =>
            p.variants.map((v) => (
              <UnstyledButton
                key={v.id}
                onClick={() => { onPick(p, v); handleClose() }}
              >
                <Paper p="sm" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>{p.title}</Text>
                      <Text size="xs" c="dimmed">
                        {v.title || v.sku || ''}
                      </Text>
                    </div>
                    <Text fw={600}>{format(api.getVariantPrice(v))}</Text>
                  </Group>
                </Paper>
              </UnstyledButton>
            )),
          )}
        </Stack>
      </Stack>
    </Modal>
  )
}
