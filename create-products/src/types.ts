export interface ProductImage {
  id?: string
  url: string
}

export interface ProductOption {
  id: string
  title: string
  values: { id: string; value: string }[]
}

export interface VariantOptionValue {
  id: string
  value: string
  option_id: string
  option: { title: string }
}

export interface Variant {
  id: string
  title: string | null
  sku: string | null
  barcode: string | null
  manage_inventory: boolean
  inventory_quantity: number
  prices: { id: string; amount: number; currency_code: string }[]
  options: VariantOptionValue[]
}

export interface Collection {
  id: string
  title: string
  handle: string
}

export interface Category {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
}

export interface ProductType {
  id: string
  value: string
}

export interface Product {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  handle: string | null
  status: 'draft' | 'published' | 'proposed' | 'rejected'
  thumbnail: string | null
  images: ProductImage[]
  collection_id: string | null
  collection?: Collection | null
  categories?: Category[]
  type?: ProductType | null
  type_id?: string | null
  tags?: { id: string; value: string }[]
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  hs_code?: string | null
  material?: string | null
  origin_country?: string | null
  metadata?: Record<string, string> | null
  options: ProductOption[]
  variants: Variant[]
}

// ── Local form types (not persisted directly) ───────────────
export interface LocalOption {
  id: string          // temp UUID or real id
  title: string
  values: string[]
}

export interface LocalVariant {
  key: string                        // combo key e.g. "S|Red"
  optionValues: Record<string, string>  // { Size: "S", Color: "Red" }
  sku: string
  barcode: string
  stock: number
  price: number                      // inherited from parent, editable per-row
}

export interface ProductFormState {
  // Language
  lang: 'en' | 'ar'

  // General EN
  title: string
  subtitle: string
  handle: string
  description: string

  // General AR (stored in metadata)
  titleAr: string
  subtitleAr: string
  descriptionAr: string

  // Media
  thumbnail: string
  images: string[]

  // Organize
  status: 'draft' | 'published'
  typeId: string
  collectionId: string
  categoryIds: string[]
  tags: string[]

  // Shipping
  weight: string
  length: string
  width: string
  height: string
  hsCode: string
  material: string
  originCountry: string

  // Options & Variants
  options: LocalOption[]
  variants: LocalVariant[]

  // Pricing (master)
  price: string
  currencyCode: string
  hasVariants: boolean
}
