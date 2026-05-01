'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import { getProducts } from '@/lib/api'
import { BarcodeDisplay } from '@/components/BarcodeDisplay'
import { Spinner } from '@/components/ui/Spinner'
import type { Product, Variant } from '@/types'

function BarcodeContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)
  const [barcodeValue, setBarcodeValue] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [showProducts, setShowProducts] = useState(false)

  // Pre-fill from URL params (from product detail page)
  useEffect(() => {
    const sku = searchParams.get('sku')
    const label = searchParams.get('label')
    if (sku) {
      setBarcodeValue(sku)
    }
  }, [searchParams])

  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setProducts([]); return }
    setLoading(true)
    try {
      const data = await getProducts(query)
      setProducts(data.products)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(q), 300)
    return () => clearTimeout(t)
  }, [q, search])

  const pickProduct = (p: Product) => {
    setSelectedProduct(p)
    setSelectedVariant(null)
    setBarcodeValue('')
    setShowProducts(false)
    setQ('')
    if (p.variants?.length === 1) {
      const v = p.variants[0]
      setSelectedVariant(v)
      setBarcodeValue(v.barcode || v.sku || '')
    }
  }

  const pickVariant = (v: Variant) => {
    setSelectedVariant(v)
    setBarcodeValue(v.barcode || v.sku || '')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Barcode Generator</h1>
        {/* Product search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setShowProducts(true) }}
            onFocus={() => setShowProducts(true)}
            placeholder="Search product…"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
          />
        </div>
        {/* Dropdown */}
        {showProducts && q.length >= 2 && (
          <div className="absolute left-4 right-4 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6"><Spinner /></div>
            ) : products.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">No products found</p>
            ) : (
              products.map(p => (
                <button
                  key={p.id}
                  onClick={() => pickProduct(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                >
                  {p.thumbnail
                    ? <img src={p.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    : <div className="w-9 h-9 rounded-lg bg-slate-100" />
                  }
                  <span className="text-sm font-medium text-slate-900">{p.title}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-nav px-4 py-5 space-y-5">
        {/* Selected product */}
        {selectedProduct && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-4">
              {selectedProduct.thumbnail && (
                <img src={selectedProduct.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
              )}
              <div>
                <p className="font-bold text-slate-900">{selectedProduct.title}</p>
                <p className="text-xs text-slate-400">{selectedProduct.variants?.length} variant(s)</p>
              </div>
            </div>

            {/* Variant picker */}
            {selectedProduct.variants && selectedProduct.variants.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Variant</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedProduct.variants.map(v => {
                    const optLabel = v.options?.map(o => o.value).join(' / ') || v.title || 'Default'
                    return (
                      <button
                        key={v.id}
                        onClick={() => pickVariant(v)}
                        className={`text-left px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                          selectedVariant?.id === v.id
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <p>{optLabel}</p>
                        {v.sku && <p className="text-[10px] opacity-60 mt-0.5">{v.sku}</p>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual barcode input */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Barcode Value</p>
          <input
            value={barcodeValue}
            onChange={e => setBarcodeValue(e.target.value)}
            placeholder="Enter SKU, barcode, or any value…"
            className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Barcode output */}
        {barcodeValue && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Code128 Barcode</p>
            <BarcodeDisplay
              value={barcodeValue}
              label={selectedVariant
                ? `${selectedProduct?.title} — ${selectedVariant.options?.map(o => o.value).join('/')  || selectedVariant.title}`
                : undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function BarcodePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>}>
      <BarcodeContent />
    </Suspense>
  )
}
