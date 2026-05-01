export interface Region {
  id: string
  name: string
  currency_code: string
  countries?: { iso_2: string }[]
}

export interface SalesChannel {
  id: string
  name: string
}

export interface Variant {
  id: string
  title: string | null
  sku: string | null
  barcode: string | null
  // Store-API enriched:
  calculated_price?: {
    calculated_amount: number
    currency_code: string
    original_amount?: number
  } | null
  // Fallback:
  prices?: { amount: number; currency_code: string }[]
  inventory_quantity?: number
  options?: { value: string }[]
}

export interface Product {
  id: string
  title: string
  thumbnail: string | null
  variants: Variant[]
}

export interface CartLine {
  product: Product
  variant: Variant
  unitPrice: number
  quantity: number
  lineDiscount: number
  lineDiscountType: 'fixed' | 'percent'
}

export interface Settings {
  backendUrl: string
  publishableKey: string
  regionId: string | null
  salesChannelId: string | null
  language: 'en' | 'ar'
}
