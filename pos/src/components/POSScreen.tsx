import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  IconSettings, IconLanguage, IconLogout, IconCamera,
  IconSearch, IconBarcode, IconShoppingCartOff, IconCategory,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { notifications } from '@/lib/toast'
import { useDisclosure } from '@/hooks/useDisclosure'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import * as api from '@/api/client'
import type { Product, Variant, CartLine } from '@/types'
import { loadSettings, saveSettings } from '@/lib/storage'
import { CartLineRow } from './CartLineRow'
import { SummaryPanel } from './SummaryPanel'
import { SearchModal } from './SearchModal'
import { BarcodeScannerModal } from './BarcodeScannerModal'
import { SettingsModal } from './SettingsModal'
import { CategoryPanel } from './CategoryPanel'
import { OrganzaLogo } from './OrganzaLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  onLogout: () => void
  onLanguageToggle: () => void
}

export function POSScreen({ onLogout, onLanguageToggle }: Props) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 900px)')

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
  const [categoryOpen, { open: openCategory, close: closeCategory }] = useDisclosure(false)

  const scanRef = useRef<HTMLInputElement>(null)

  const currentRegion = useMemo(() => regions.find(r => r.id === regionId), [regions, regionId])
  const currencyCode = currentRegion?.currency_code

  const loadBootstrap = useCallback(async () => {
    try {
      const [regs, chans] = await Promise.all([api.getRegions(), api.getSalesChannels()])
      setRegions(regs); setSalesChannels(chans)
      const s = loadSettings()
      const useRegion = regs.find(r => r.id === s.regionId)?.id || regs[0]?.id || ''
      const useChannel = chans.find(c => c.id === s.salesChannelId)?.id || chans[0]?.id || ''
      setRegionId(useRegion); setSalesChannelId(useChannel)
      saveSettings({ ...s, regionId: useRegion, salesChannelId: useChannel })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'unauthorized') { notifications.show({ message: t('toast.sessionExpired'), color: 'red' }); onLogout() }
      else notifications.show({ message: msg, color: 'red' })
    }
  }, [onLogout, t])

  useEffect(() => { loadBootstrap() }, [loadBootstrap])

  useEffect(() => {
    if (isMobile) return
    const timer = setInterval(() => {
      const a = document.activeElement
      if (!searchOpen && !scannerOpen && !settingsOpen && !categoryOpen &&
        a?.tagName !== 'INPUT' && a?.tagName !== 'TEXTAREA' && a?.tagName !== 'BUTTON') {
        scanRef.current?.focus()
      }
    }, 800)
    return () => clearInterval(timer)
  }, [isMobile, searchOpen, scannerOpen, settingsOpen, categoryOpen])

  const addToCart = useCallback((product: Product, variant: Variant) => {
    const price = api.getVariantPrice(variant)
    setCart(prev => {
      const ex = prev.find(l => l.variant.id === variant.id)
      if (ex) return prev.map(l => l.variant.id === variant.id ? { ...l, quantity: l.quantity + 1 } : l)
      return [...prev, { product, variant, unitPrice: price, quantity: 1, lineDiscount: 0, lineDiscountType: 'fixed' }]
    })
    notifications.show({ message: t('toast.added', { name: product.title }), color: 'green', autoClose: 1500 })
  }, [t])

  const lookupAndAdd = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    if (!loadSettings().publishableKey) { notifications.show({ message: t('toast.missingKey'), color: 'red', autoClose: 4000 }); return }
    try {
      const found = await api.findByCode(trimmed)
      if (!found) { notifications.show({ message: t('toast.notFound', { code: trimmed }), color: 'red' }); return }
      addToCart(found.product, found.variant)
    } catch (e: unknown) {
      notifications.show({ message: e instanceof Error ? e.message : String(e), color: 'red' })
    }
  }, [addToCart, t])

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = scanInput; setScanInput(''); lookupAndAdd(code)
  }

  const updateQty = (variantId: string, delta: number) =>
    setCart(prev => prev.map(l => l.variant.id === variantId ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l).filter(l => l.quantity > 0))

  const removeItem = (variantId: string) => setCart(prev => prev.filter(l => l.variant.id !== variantId))

  const setLineDiscount = (variantId: string, value: number, type: 'fixed' | 'percent') =>
    setCart(prev => prev.map(l => l.variant.id === variantId ? { ...l, lineDiscount: value, lineDiscountType: type } : l))

  const calcLineTotal = (item: CartLine) => {
    const gross = item.unitPrice * item.quantity
    const disc = item.lineDiscountType === 'percent' ? gross * (item.lineDiscount / 100) : item.lineDiscount * item.quantity
    return Math.max(0, gross - disc)
  }

  const subtotal = cart.reduce((s, l) => s + calcLineTotal(l), 0)
  const cartDiscountAmount = cartDiscountType === 'percent' ? subtotal * (cartDiscountValue / 100) : Math.min(cartDiscountValue, subtotal)
  const total = Math.max(0, subtotal - cartDiscountAmount)

  const completeSale = async () => {
    if (!cart.length) { notifications.show({ message: t('toast.emptyCart'), color: 'red' }); return }
    if (!regionId) { notifications.show({ message: t('toast.noRegion'), color: 'red' }); return }
    setProcessing(true)
    try {
      const items = cart.map(l => {
        const gross = l.unitPrice * l.quantity
        const disc = l.lineDiscountType === 'percent' ? gross * (l.lineDiscount / 100) : l.lineDiscount * l.quantity
        return { variant_id: l.variant.id, quantity: l.quantity, unit_price: Math.round(Math.max(0, (gross - disc) / l.quantity) * 100) }
      })
      const order = await api.createOrder({ items, regionId, salesChannelId: salesChannelId || null, paymentMethod, cartDiscount: cartDiscountAmount })
      notifications.show({ message: t('toast.saleComplete', { id: order.display_id ?? order.id }), color: 'green', autoClose: 4000 })
      setCart([]); setCartDiscountValue(0)
      if (isMobile) closeSummary()
    } catch (e: unknown) {
      notifications.show({ message: t('toast.saleFailed', { msg: e instanceof Error ? e.message : String(e) }), color: 'red', autoClose: 5000 })
    } finally { setProcessing(false) }
  }

  const summaryProps = {
    currencyCode, subtotal, cartDiscountValue, cartDiscountType, cartDiscountAmount, total,
    paymentMethod, canCheckout: cart.length > 0, processing, cartLength: cart.length,
    onCartDiscountChange: (v: number, ty: 'fixed' | 'percent') => { setCartDiscountValue(v); setCartDiscountType(ty) },
    onPaymentChange: setPaymentMethod, onCheckout: completeSale, onClear: () => setCart([]),
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* ── Header ── */}
        <header className="h-16 flex-shrink-0 flex items-center px-3 sm:px-5 justify-between gap-3"
          style={{ background: '#235C63', boxShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
          {/* Brand */}
          <div className="flex-shrink-0">
            <OrganzaLogo size={54} style={{ flexShrink: 0 }} />
          </div>

          {/* Selects */}
          <div className="flex-1 flex items-center justify-center gap-2 max-w-[500px]">
            <Select value={regionId} onValueChange={v => { setRegionId(v); saveSettings({ ...loadSettings(), regionId: v }) }}>
              <SelectTrigger size="sm" className="border-white/20 text-white bg-white/10 hover:bg-white/15 focus:ring-white/30" style={{ width: isMobile ? 130 : 190, color: 'white' }}>
                <SelectValue placeholder={t('pos.region')} />
              </SelectTrigger>
              <SelectContent>
                {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.currency_code.toUpperCase()})</SelectItem>)}
              </SelectContent>
            </Select>

            {!isMobile && salesChannels.length > 1 && (
              <Select value={salesChannelId} onValueChange={v => { setSalesChannelId(v); saveSettings({ ...loadSettings(), salesChannelId: v }) }}>
                <SelectTrigger size="sm" className="border-white/20 text-white bg-white/10 hover:bg-white/15 focus:ring-white/30" style={{ width: 190, color: 'white' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {salesChannels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/15 flex-shrink-0">
                <IconSettings size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuItem onClick={onLanguageToggle}><IconLanguage size={14} />{t('app.language')}</DropdownMenuItem>
              <DropdownMenuItem onClick={openSettings}><IconSettings size={14} />{t('app.settings')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <IconLogout size={14} />{t('app.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 360px' }}>

          {/* LEFT */}
          <div className="flex flex-col overflow-hidden bg-background">
            {/* Scan bar */}
            <div className="p-3 border-b border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  ref={scanRef}
                  value={scanInput}
                  onChange={e => setScanInput(e.currentTarget.value)}
                  onKeyDown={handleScan}
                  placeholder={t('pos.scanPlaceholder')}
                  autoFocus
                  leftSection={<IconBarcode size={17} />}
                  className="flex-1 h-11"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="brand" size="icon-lg" onClick={openScanner}><IconCamera size={20} /></Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('pos.scanWithCamera')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon-lg" onClick={openSearch}><IconSearch size={20} /></Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('pos.manualSearch')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-lg" onClick={openCategory} className="border-primary/30 text-primary hover:bg-primary/10"><IconCategory size={20} /></Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('pos.browseCategories')}</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Cart header */}
            {cart.length > 0 && (
              <div className="px-4 pt-3 pb-2 bg-card border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cart</span>
                  <Badge variant="default" size="dot">{cart.length}</Badge>
                </div>
              </div>
            )}

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-10">
                  <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
                    <IconShoppingCartOff size={34} className="text-muted-foreground/40" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg text-muted-foreground/70">{t('pos.emptyCart')}</p>
                    <p className="text-sm text-muted-foreground/50 mt-1 max-w-[220px]">{t('pos.emptyCartHint')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button variant="secondary" size="sm" onClick={openSearch}><IconSearch size={15} />{t('pos.manualSearch')}</Button>
                    <Button variant="outline" size="sm" onClick={openCategory} className="border-primary/30 text-primary hover:bg-primary/10"><IconCategory size={15} />{t('pos.browseCategories')}</Button>
                  </div>
                </div>
              ) : (
                cart.map(item => (
                  <CartLineRow key={item.variant.id} item={item} currencyCode={currencyCode}
                    onQty={updateQty} onRemove={removeItem} onDiscount={setLineDiscount} lineTotal={calcLineTotal(item)} />
                ))
              )}
            </div>

            {/* Mobile checkout CTA */}
            {isMobile && cart.length > 0 && (
              <div className="p-3 border-t border-border bg-card flex-shrink-0">
                <Button variant="brand" size="lg" className="w-full" onClick={openSummary}>
                  {t('summary.complete')} · {total.toFixed(2)}
                </Button>
              </div>
            )}
          </div>

          {/* RIGHT: Desktop summary */}
          {!isMobile && (
            <div className="border-l border-border bg-card overflow-hidden flex flex-col">
              <SummaryPanel {...summaryProps} />
            </div>
          )}
        </div>

        {/* Mobile summary sheet */}
        <Sheet open={summaryOpen} onOpenChange={o => !o && closeSummary()}>
          <SheetContent side="bottom" className="flex flex-col p-0" style={{ height: '90dvh' }}>
            <SheetHeader className="flex-shrink-0">
              <SheetTitle>{t('summary.title')}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
              <SummaryPanel {...summaryProps} />
            </div>
          </SheetContent>
        </Sheet>

        <SearchModal opened={searchOpen} onClose={closeSearch} onPick={addToCart} currencyCode={currencyCode} />
        <BarcodeScannerModal opened={scannerOpen} onClose={closeScanner} onScan={async code => { closeScanner(); await lookupAndAdd(code) }} />
        <SettingsModal opened={settingsOpen} onClose={closeSettings} onSaved={loadBootstrap} />
        <CategoryPanel opened={categoryOpen} onClose={closeCategory} onPick={(p, v) => { addToCart(p, v); closeCategory() }} currencyCode={currencyCode} />
      </div>
    </TooltipProvider>
  )
}
