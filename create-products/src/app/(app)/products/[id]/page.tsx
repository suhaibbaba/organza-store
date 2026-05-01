'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Barcode } from 'lucide-react'
import { getProduct } from '@/lib/api'
import { ProductForm } from '@/components/ProductForm'
import { Spinner } from '@/components/ui/Spinner'
import { statusColor } from '@/lib/utils'
import type { Product } from '@/types'
import { toast } from 'sonner'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const p = await getProduct(id)
      setProduct(p)
    } catch {
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>
  )
  if (!product) return null

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur border-b border-slate-100 px-4 md:px-6 h-14 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 truncate">{product.title}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(product.status)}`}>
              {product.status}
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push('/barcode')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded-xl hover:bg-indigo-100 transition-colors flex-shrink-0"
        >
          <Barcode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Barcode</span>
        </button>
      </div>

      <div className="px-4 md:px-6 py-5">
        <ProductForm product={product} onSaved={load} />
      </div>
    </div>
  )
}
