import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  AppShell, Group, Title, ActionIcon, Select, Button, TextInput,
  Stack, Text, Center, Menu, Drawer, Box, Tooltip,
} from '@mantine/core'
import {
  IconSettings, IconLanguage, IconLogout, IconCamera, IconSearch, IconReceipt,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { notifications } from '@mantine/notifications'
import { useMediaQuery, useDisclosure } from '@mantine/hooks'
import * as api from '@/api/client'
import type { Product, Variant, CartLine } from '@/types'
import { loadSettings, saveSettings } from '@/lib/storage'
import { CartLineRow } from './CartLineRow'
import { SummaryPanel } from './SummaryPanel'
import { SearchModal } from './SearchModal'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import { SettingsModal } from './SettingsModal'

interface Props {
  onLogout: () => void
  onLanguageToggle: () => void
}

export function POSScreen({ onLogout, onLanguageToggle }: Props) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 900px)')

  // ── State ────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([])
  const [scanInput, setScanInput] = useState('')
  const [cartDiscountValue, setCartDiscountValue] = useState(0)
  const [cartDiscountType, setCartDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [processing, setProcessing] = useState(false)

  const [regions, setRegions] = useState<Awaited<ReturnType<typeof api.getRegions>>>([])
  const [salesChannels, setSalesChannels] = useState<Awaited<ReturnType<typeof api.getSalesChannels>>>([])
  const [regionId, setRegionId] = useState(loadSettings().regionId || '')
  const [salesChannelId, setSalesChannelId] = useState(loadSettings().salesChannelId || '')

  const [searchOpen, { open: openSearch, close: closeSearch }] = useDisclosure(false)
  const [scannerOpen, { open: openScanner, close: closeScanner }] = useDisclosure(false)
  const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false)
  const [summaryOpen, { open: openSummary, close: closeSummary }] = useDisclosure(false)

  const scanRef = useRef<HTMLInputElement>(null)

  // ── Effects ──────────────────────────────────
  const currentRegion = useMemo(
    () => regions.find((r) => r.id === regionId),
    [regions, regionId],
  )
  const currencyCode = currentRegion?.currency_code

  const loadBootstrap = useCallback(async () => {
    try {
      const [regs, chans] = await Promise.all([api.getRegions(), api.getSalesChannels()])
      setRegions(regs)
      setSalesChannels(chans)

      const s = loadSettings()
      const useRegion = regs.find((r) => r.id === s.regionId)?.id || regs[0]?.id || ''
      const useChannel = chans.find((c) => c.id === s.salesChannelId)?.id || chans[0]?.id || ''

      setRegionId(useRegion)
      setSalesChannelId(useChannel)
      saveSettings({ ...s, regionId: useRegion, salesChannelId: useChannel })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'unauthorized') {
        notifications.show({ message: t('toast.sessionExpired'), color: 'red' })
        onLogout()
      } else {
        notifications.show({ message: msg, color: 'red' })
      }
    }
  }, [onLogout, t])

  useEffect(() => { loadBootstrap() }, [loadBootstrap])

  // Keep scanner input focused (desktop only)
  useEffect(() => {
    if (isMobile) return
    const timer = setInterval(() => {
      const active = document.activeElement
      if (
        !searchOpen && !scannerOpen && !settingsOpen &&
        active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA' && active?.tagName !== 'BUTTON'
      ) {
        scanRef.current?.focus()
      }
    }, 800)
    return () => clearInterval(timer)
  }, [isMobile, searchOpen, scannerOpen, settingsOpen])

  // ── Handlers ─────────────────────────────────
  const handleRegionChange = (newId: string | null) => {
    if (!newId) return
    setRegionId(newId)
    saveSettings({ ...loadSettings(), regionId: newId })
  }

  const handleScanChannelChange = (newId: string | null) => {
    if (!newId) return
    setSalesChannelId(newId)
    saveSettings({ ...loadSettings(), salesChannelId: newId })
  }

  const addToCart = useCallback((product: Product, variant: Variant) => {
    const price = api.getVariantPrice(variant)
    setCart((prev) => {
      const existing = prev.find((l) => l.variant.id === variant.id)
      if (existing) {
        return prev.map((l) =>
          l.variant.id === variant.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        { product, variant, unitPrice: price, quantity: 1, lineDiscount: 0, lineDiscountType: 'fixed' },
      ]
    })
    notifications.show({
      message: t('toast.added', { name: product.title }),
      color: 'green',
      autoClose: 1500,
    })
  }, [t])

  const lookupAndAdd = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return

    if (!loadSettings().publishableKey) {
      notifications.show({ message: t('toast.missingKey'), color: 'red', autoClose: 4000 })
      return
    }

    try {
      const found = await api.findByCode(trimmed)
      if (!found) {
        notifications.show({ message: t('toast.notFound', { code: trimmed }), color: 'red' })
        return
      }
      addToCart(found.product, found.variant)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      notifications.show({ message: msg, color: 'red' })
    }
  }, [addToCart, t])

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = scanInput
    setScanInput('')
    lookupAndAdd(code)
  }

  const handleCameraScan = async (code: string) => {
    closeScanner()
    await lookupAndAdd(code)
  }

  const updateQty = (variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.variant.id === variantId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  const removeItem = (variantId: string) => {
    setCart((prev) => prev.filter((l) => l.variant.id !== variantId))
  }

  const setLineDiscount = (variantId: string, value: number, type: 'fixed' | 'percent') => {
    setCart((prev) =>
      prev.map((l) =>
        l.variant.id === variantId ? { ...l, lineDiscount: value, lineDiscountType: type } : l,
      ),
    )
  }

  // ── Totals ───────────────────────────────────
  const calcLineTotal = (item: CartLine): number => {
    const gross = item.unitPrice * item.quantity
    const disc =
      item.lineDiscountType === 'percent'
        ? gross * (item.lineDiscount / 100)
        : item.lineDiscount * item.quantity
    return Math.max(0, gross - disc)
  }

  const subtotal = cart.reduce((s, l) => s + calcLineTotal(l), 0)
  const cartDiscountAmount =
    cartDiscountType === 'percent'
      ? subtotal * (cartDiscountValue / 100)
      : Math.min(cartDiscountValue, subtotal)
  const total = Math.max(0, subtotal - cartDiscountAmount)

  // ── Checkout ─────────────────────────────────
  const completeSale = async () => {
    if (cart.length === 0) {
      notifications.show({ message: t('toast.emptyCart'), color: 'red' })
      return
    }
    if (!regionId) {
      notifications.show({ message: t('toast.noRegion'), color: 'red' })
      return
    }

    setProcessing(true)
    try {
      // Convert each line's effective unit price (after line discount) to cents
      const items = cart.map((l) => {
        const gross = l.unitPrice * l.quantity
        const lineDisc =
          l.lineDiscountType === 'percent'
            ? gross * (l.lineDiscount / 100)
            : l.lineDiscount * l.quantity
        const netPerUnit = Math.max(0, (gross - lineDisc) / l.quantity)
        return {
          variant_id: l.variant.id,
          quantity: l.quantity,
          unit_price: Math.round(netPerUnit * 100),
        }
      })

      const order = await api.createOrder({
        items,
        regionId,
        salesChannelId: salesChannelId || null,
        paymentMethod,
        cartDiscount: cartDiscountAmount,
      })

      notifications.show({
        message: t('toast.saleComplete', { id: order.display_id ?? order.id }),
        color: 'green',
        autoClose: 4000,
      })
      setCart([])
      setCartDiscountValue(0)
      if (isMobile) closeSummary()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      notifications.show({ message: t('toast.saleFailed', { msg }), color: 'red', autoClose: 5000 })
    } finally {
      setProcessing(false)
    }
  }

  // ── Render ───────────────────────────────────
  return (
    <AppShell header={{ height: 60 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Title order={4} style={{ whiteSpace: 'nowrap' }}>🛒 {t('app.title')}</Title>

          <Group gap="xs" wrap="nowrap">
            <Select
              value={regionId}
              onChange={handleRegionChange}
              data={regions.map((r) => ({
                value: r.id,
                label: `${r.name} (${r.currency_code.toUpperCase()})`,
              }))}
              size="xs"
              w={isMobile ? 120 : 180}
              placeholder={t('pos.region')}
              allowDeselect={false}
            />

            {!isMobile && salesChannels.length > 1 && (
              <Select
                value={salesChannelId}
                onChange={handleScanChannelChange}
                data={salesChannels.map((c) => ({ value: c.id, label: c.name }))}
                size="xs"
                w={180}
                allowDeselect={false}
              />
            )}

            <Menu shadow="md" position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="default" size="lg"><IconSettings size={18} /></ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconLanguage size={14} />} onClick={onLanguageToggle}>
                  {t('app.language')}
                </Menu.Item>
                <Menu.Item leftSection={<IconSettings size={14} />} onClick={openSettings}>
                  {t('app.settings')}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={onLogout}>
                  {t('app.logout')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Box style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
          height: 'calc(100dvh - var(--app-shell-header-height, 60px))',
          overflow: 'hidden',
        }}>
          <Box style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Scanner bar */}
            <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  ref={scanRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.currentTarget.value)}
                  onKeyDown={handleScan}
                  placeholder={t('pos.scanPlaceholder')}
                  size="lg"
                  style={{ flex: 1 }}
                  autoFocus
                  leftSection={<IconReceipt size={20} />}
                />
                <Tooltip label={t('pos.scanWithCamera')}>
                  <ActionIcon size="xl" variant="filled" color="blue" onClick={openScanner}>
                    <IconCamera size={22} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('pos.manualSearch')}>
                  <ActionIcon size="xl" variant="default" onClick={openSearch}>
                    <IconSearch size={22} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Box>

            {/* Cart */}
            <Box style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {cart.length === 0 ? (
                <Center h="100%">
                  <Stack align="center" gap={4}>
                    <Text size="lg" c="dimmed">{t('pos.emptyCart')}</Text>
                    <Text size="sm" c="dimmed">{t('pos.emptyCartHint')}</Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {cart.map((item) => (
                    <CartLineRow
                      key={item.variant.id}
                      item={item}
                      currencyCode={currencyCode}
                      onQty={updateQty}
                      onRemove={removeItem}
                      onDiscount={setLineDiscount}
                      lineTotal={calcLineTotal(item)}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Mobile: floating summary button */}
            {isMobile && cart.length > 0 && (
              <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                <Button size="lg" fullWidth onClick={openSummary}>
                  {t('summary.complete')} · {(total).toFixed(2)}
                </Button>
              </Box>
            )}
          </Box>

          {/* RIGHT: summary (desktop) */}
          {!isMobile && (
            <Box style={{ borderLeft: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-gray-0)' }}>
              <SummaryPanel
                currencyCode={currencyCode}
                subtotal={subtotal}
                cartDiscountValue={cartDiscountValue}
                cartDiscountType={cartDiscountType}
                cartDiscountAmount={cartDiscountAmount}
                total={total}
                paymentMethod={paymentMethod}
                canCheckout={cart.length > 0}
                processing={processing}
                cartLength={cart.length}
                onCartDiscountChange={(v, ty) => { setCartDiscountValue(v); setCartDiscountType(ty) }}
                onPaymentChange={setPaymentMethod}
                onCheckout={completeSale}
                onClear={() => setCart([])}
              />
            </Box>
          )}
        </Box>

        {/* Mobile: summary drawer */}
        {isMobile && (
          <Drawer
            opened={summaryOpen}
            onClose={closeSummary}
            position="bottom"
            size="85%"
            title={t('summary.title')}
          >
            <SummaryPanel
              currencyCode={currencyCode}
              subtotal={subtotal}
              cartDiscountValue={cartDiscountValue}
              cartDiscountType={cartDiscountType}
              cartDiscountAmount={cartDiscountAmount}
              total={total}
              paymentMethod={paymentMethod}
              canCheckout={cart.length > 0}
              processing={processing}
              cartLength={cart.length}
              onCartDiscountChange={(v, ty) => { setCartDiscountValue(v); setCartDiscountType(ty) }}
              onPaymentChange={setPaymentMethod}
              onCheckout={completeSale}
              onClear={() => setCart([])}
            />
          </Drawer>
        )}
      </AppShell.Main>

      <SearchModal
        opened={searchOpen}
        onClose={closeSearch}
        onPick={addToCart}
        currencyCode={currencyCode}
      />
      <BarcodeScannerModal
        opened={scannerOpen}
        onClose={closeScanner}
        onScan={handleCameraScan}
      />
      <SettingsModal
        opened={settingsOpen}
        onClose={closeSettings}
        onSaved={loadBootstrap}
      />
    </AppShell>
  )
}
