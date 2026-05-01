'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ProductForm } from '@/components/ProductForm'
import type { Product } from '@/types'

export default function NewProductPage() {
  const router = useRouter()
  const handleSaved = (p: Product) => router.push(`/products/${p.id}`)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur border-b border-slate-100 px-4 md:px-6 h-14 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-base font-bold text-slate-900">New Product</h1>
      </div>
      <div className="px-4 md:px-6 py-5">
        <ProductForm onSaved={handleSaved} />
      </div>
    </div>
  )
}
