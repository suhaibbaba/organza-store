'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, X, ChevronDown, ChevronUp, Image as ImageIcon, Globe,
  Package, Truck, Tag, Layers, DollarSign, Camera, Hash,
  Pencil, Check, GripVertical, Sparkles, Loader, RotateCcw,
} from 'lucide-react'
import {
  getCollections, getCategories, getProductTypes,
  createCollection, createCategory, createProductType,
  uploadFile, createProduct, updateProduct,
  type CreateProductInput,
} from '@/lib/api'
import { generateVariants, slugify } from '@/lib/variants'
import { generateSKU, generateBarcode } from '@/lib/sku'
import { getMainLang } from '@/lib/storage'
import { OPTION_PRESETS } from '@/lib/defaults'
import { Select, type SelectOption } from './ui/Select'
import { MultiSelect, type MultiSelectOption } from './ui/MultiSelect'
import type { Product, Collection, Category, ProductType, LocalOption, LocalVariant, ProductFormState } from '@/types'
import { Spinner } from './ui/Spinner'
import { Button } from './ui/Button'
import { cn } from '@/lib/utils'

const uid = () => Math.random().toString(36).slice(2)

const EMPTY_STATE: ProductFormState = {
  lang: 'en',
  title: '', subtitle: '', handle: '', description: '',
  titleAr: '', subtitleAr: '', descriptionAr: '',
  thumbnail: '', images: [],
  status: 'draft', typeId: '', collectionId: '', categoryIds: [], tags: [],
  weight: '', length: '', width: '', height: '',
  hsCode: '', material: '', originCountry: '',
  options: [], variants: [],
  price: '', currencyCode: 'usd',
  hasVariants: false,
}

function productToState(p: Product): ProductFormState {
  const meta = p.metadata || {}
  const options: LocalOption[] = (p.options || []).map(o => ({
    id: o.id, title: o.title, values: (o.values || []).map(v => v.value),
  }))
  const variants: LocalVariant[] = (p.variants || []).map(v => {
    const optVals: Record<string, string> = {}
    ;(v.options || []).forEach(o => { optVals[o.option?.title || ''] = o.value })
    return {
      key: Object.values(optVals).join('|'),
      optionValues: optVals,
      sku: v.sku || '', barcode: v.barcode || '',
      stock: v.inventory_quantity ?? 1, price: v.prices?.[0]?.amount ?? 0,
    }
  })
  const masterPrice = p.variants?.[0]?.prices?.[0]?.amount ?? 0
  return {
    lang: 'en',
    title: p.title || '', subtitle: p.subtitle || '', handle: p.handle || '',
    description: p.description || '',
    titleAr: meta.title_ar || '', subtitleAr: meta.subtitle_ar || '', descriptionAr: meta.description_ar || '',
    thumbnail: p.thumbnail || '', images: (p.images || []).map(i => i.url),
    status: p.status === 'published' ? 'published' : 'draft',
    typeId: p.type_id || '', collectionId: p.collection_id || '',
    categoryIds: (p.categories || []).map(c => c.id),
    tags: (p.tags || []).map(t => t.value),
    weight: p.weight ? String(p.weight) : '', length: p.length ? String(p.length) : '',
    width: p.width ? String(p.width) : '', height: p.height ? String(p.height) : '',
    hsCode: p.hs_code || '', material: p.material || '', originCountry: p.origin_country || '',
    options, variants,
    price: masterPrice ? String(masterPrice / 100) : '',
    currencyCode: p.variants?.[0]?.prices?.[0]?.currency_code || 'usd',
    hasVariants: (p.options?.length ?? 0) > 0,
  }
}

// ── Accordion Section ────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-5 py-4 bg-slate-50/50 hover:bg-slate-100/50 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 flex-1">{title}</h3>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>
      {open && <div className="p-5 border-t border-slate-100">{children}</div>}
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inp = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
const monoDisabled = "w-full border border-slate-100 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 bg-slate-50 font-mono cursor-not-allowed"

// ── AI Translate Button ──────────────────────────────────────
function TranslateBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="Translate with AI"
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 text-violet-600 text-xs font-semibold rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors flex-shrink-0"
    >
      {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      AI
    </button>
  )
}

// ── Bilingual Field ──────────────────────────────────────────
function BiField({
  label, mainLang,
  enValue, onEnChange, enPlaceholder,
  arValue, onArChange, arPlaceholder,
  multiline = false, onTranslate,
}: {
  label: string; mainLang: 'en' | 'ar';
  enValue: string; onEnChange: (v: string) => void; enPlaceholder?: string;
  arValue: string; onArChange: (v: string) => void; arPlaceholder?: string;
  multiline?: boolean; onTranslate?: (from: 'en' | 'ar', to: 'en' | 'ar') => void;
}) {
  const [translating, setTranslating] = useState<'to-ar' | 'to-en' | null>(null)

  const handleTranslate = async (from: 'en' | 'ar', to: 'en' | 'ar') => {
    if (!onTranslate) return
    setTranslating(to === 'ar' ? 'to-ar' : 'to-en')
    try { await onTranslate(from, to) } finally { setTranslating(null) }
  }

  const fieldCls = multiline
    ? `${inp} resize-none`
    : inp

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* English */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', mainLang === 'en' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>
              EN {mainLang === 'en' && '★'}
            </span>
            {onTranslate && enValue.trim() && (
              <TranslateBtn loading={translating === 'to-ar'} onClick={() => handleTranslate('en', 'ar')} />
            )}
          </div>
          {multiline
            ? <textarea value={enValue} onChange={e => onEnChange(e.target.value)} rows={3} placeholder={enPlaceholder} className={fieldCls} dir="ltr" />
            : <input value={enValue} onChange={e => onEnChange(e.target.value)} placeholder={enPlaceholder} className={fieldCls} dir="ltr" />
          }
        </div>
        {/* Arabic */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', mainLang === 'ar' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>
              AR {mainLang === 'ar' && '★'}
            </span>
            {onTranslate && arValue.trim() && (
              <TranslateBtn loading={translating === 'to-en'} onClick={() => handleTranslate('ar', 'en')} />
            )}
          </div>
          {multiline
            ? <textarea value={arValue} onChange={e => onArChange(e.target.value)} rows={3} placeholder={arPlaceholder} className={fieldCls} dir="rtl" />
            : <input value={arValue} onChange={e => onArChange(e.target.value)} placeholder={arPlaceholder} className={fieldCls} dir="rtl" />
          }
        </div>
      </div>
    </div>
  )
}

// ── Option Row ───────────────────────────────────────────────
function OptionRow({ opt, onRemove, onRename, onAddValue, onRemoveValue }: {
  opt: LocalOption
  onRemove: () => void
  onRename: (title: string) => void
  onAddValue: (value: string) => void
  onRemoveValue: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(opt.title)
  const [valueInput, setValueInput] = useState('')
  const valueRef = useRef<HTMLInputElement>(null)

  const commitName = () => { if (nameInput.trim()) onRename(nameInput.trim()); setEditing(false) }
  const commitValue = () => {
    const v = valueInput.trim()
    if (v && !opt.values.includes(v)) { onAddValue(v); setValueInput(''); valueRef.current?.focus() }
  }

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 border-b border-slate-100">
        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
        {editing
          ? <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitName()} onBlur={commitName}
              className="flex-1 text-sm font-bold bg-white border border-indigo-400 rounded-lg px-2 py-1 focus:outline-none" />
          : <span className="flex-1 text-sm font-bold text-slate-800">{opt.title}</span>
        }
        <button type="button" onClick={() => setEditing(!editing)}
          className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
          {editing ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <Pencil className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        <button type="button" onClick={onRemove}
          className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors">
          <X className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {opt.values.length === 0 && (
            <span className="text-xs text-slate-400 italic">No values yet — type below + Enter</span>
          )}
          {opt.values.map(val => (
            <span key={val} className="group flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm hover:border-red-300 hover:bg-red-50 transition-colors">
              {val}
              <button type="button" onClick={() => onRemoveValue(val)} className="opacity-40 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3 text-red-500" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input ref={valueRef} value={valueInput} onChange={e => setValueInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commitValue()}
            placeholder="Type value + Enter (e.g. S, Red, XL, 42)"
            className="flex-1 border border-dashed border-slate-300 bg-slate-50 rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
          <button type="button" onClick={commitValue}
            className="px-3.5 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ───────────────────────────────────────────
interface Props { product?: Product; onSaved?: (p: Product) => void }

export function ProductForm({ product, onSaved }: Props) {
  const router = useRouter()
  const mainLang = getMainLang()
  const [s, setS] = useState<ProductFormState>(() => {
    const base = product ? productToState(product) : { ...EMPTY_STATE }
    base.lang = mainLang
    return base
  })
  const [saving, setSaving] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [newOptionTitle, setNewOptionTitle] = useState('')
  const thumbInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const [collections, setCollections] = useState<Collection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])

  const set = useCallback(<K extends keyof ProductFormState>(key: K, val: ProductFormState[K]) => {
    setS(prev => ({ ...prev, [key]: val }))
  }, [])

  useEffect(() => {
    if (!product) set('handle', slugify(s.title))
  }, [s.title, product, set])

  useEffect(() => {
    if (!s.hasVariants) {
      setS(prev => ({ ...prev, variants: [], options: [] }))
      return
    }
    const price = parseFloat(s.price) || 0
    const newVariants = generateVariants(s.title, s.options, Math.round(price * 100), s.variants)
    setS(prev => ({ ...prev, variants: newVariants }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.options, s.price, s.title, s.hasVariants])

  const handlePriceChange = (val: string) => {
    const price = parseFloat(val) || 0
    setS(prev => ({ ...prev, price: val, variants: prev.variants.map(v => ({ ...v, price: Math.round(price * 100) })) }))
  }

  useEffect(() => {
    Promise.all([getCollections(), getCategories(), getProductTypes()])
      .then(([cols, cats, types]) => { setCollections(cols); setCategories(cats); setProductTypes(types) })
      .catch(() => {})
  }, [])

  // ── AI Translate ─────────────────────────────────────────
  const translate = async (text: string, from: 'en' | 'ar', to: 'en' | 'ar'): Promise<string> => {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fromLang: from, toLang: to }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); return '' }
    return data.translated || ''
  }

  const makeTranslate = (enField: keyof ProductFormState, arField: keyof ProductFormState) =>
    async (from: 'en' | 'ar', to: 'en' | 'ar') => {
      const srcVal = from === 'en' ? s[enField] as string : s[arField] as string
      if (!srcVal.trim()) return
      const result = await translate(srcVal, from, to)
      if (result) {
        if (to === 'ar') set(arField, result)
        else set(enField, result)
        toast.success('Translated!')
      }
    }

  // ── Images ───────────────────────────────────────────────
  const handleThumbUpload = async (file: File) => {
    setUploadingThumb(true)
    try { const url = await uploadFile(file); set('thumbnail', url) }
    catch { toast.error('Upload failed') } finally { setUploadingThumb(false) }
  }

  const handleImgUpload = async (files: FileList) => {
    setUploadingImg(true)
    try {
      const urls = await Promise.all(Array.from(files).map(uploadFile))
      setS(prev => ({ ...prev, images: [...prev.images, ...urls] }))
    } catch { toast.error('Upload failed') } finally { setUploadingImg(false) }
  }

  const moveImage = (idx: number, dir: -1 | 1) => {
    const imgs = [...s.images]; const to = idx + dir
    if (to < 0 || to >= imgs.length) return
    ;[imgs[idx], imgs[to]] = [imgs[to], imgs[idx]]; set('images', imgs)
  }

  // ── Tags ────────────────────────────────────────────────
  const addTag = () => {
    const t = newTag.trim(); if (!t || s.tags.includes(t)) return
    set('tags', [...s.tags, t]); setNewTag('')
  }

  // ── Options ─────────────────────────────────────────────
  const addOption = (title: string, values: string[] = []) => {
    if (!title.trim()) return
    if (s.options.find(o => o.title.toLowerCase() === title.toLowerCase())) {
      toast.error('Option already exists'); return
    }
    setS(prev => ({ ...prev, options: [...prev.options, { id: uid(), title: title.trim(), values }] }))
  }

  const removeOption = (id: string) => setS(prev => ({ ...prev, options: prev.options.filter(o => o.id !== id) }))
  const renameOption = (id: string, title: string) => setS(prev => ({ ...prev, options: prev.options.map(o => o.id === id ? { ...o, title } : o) }))
  const addOptionValue = (id: string, value: string) => setS(prev => ({ ...prev, options: prev.options.map(o => o.id === id && !o.values.includes(value) ? { ...o, values: [...o.values, value] } : o) }))
  const removeOptionValue = (id: string, value: string) => setS(prev => ({ ...prev, options: prev.options.map(o => o.id === id ? { ...o, values: o.values.filter(v => v !== value) } : o) }))
  const updateVariantStock = (key: string, stock: number) => setS(prev => ({ ...prev, variants: prev.variants.map(v => v.key === key ? { ...v, stock } : v) }))

  // ── Dropdowns ────────────────────────────────────────────
  const collectionOptions: SelectOption[] = collections.map(c => ({ value: c.id, label: c.title }))
  const typeOptions: SelectOption[] = productTypes.map(t => ({ value: t.id, label: t.value }))
  const categoryOptions: MultiSelectOption[] = categories.map(c => ({ value: c.id, label: c.name, parentId: c.parent_category_id, depth: c.parent_category_id ? 1 : 0 }))

  const handleCreateCollection = async (name: string) => {
    const c = await createCollection(name); setCollections(prev => [...prev, c]); set('collectionId', c.id); toast.success('Collection created')
  }
  const handleCreateCategory = async (name: string) => {
    const c = await createCategory(name); setCategories(prev => [...prev, c]); set('categoryIds', [...s.categoryIds, c.id]); toast.success('Category created')
  }
  const handleCreateType = async (value: string) => {
    const t = await createProductType(value); setProductTypes(prev => [...prev, t]); set('typeId', t.id); toast.success('Type created')
  }

  // ── Save ─────────────────────────────────────────────────
  const save = async () => {
    if (!s.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const priceAmount = Math.round((parseFloat(s.price) || 0) * 100)
      const metadata: Record<string, string> = {}
      if (s.titleAr) metadata.title_ar = s.titleAr
      if (s.subtitleAr) metadata.subtitle_ar = s.subtitleAr
      if (s.descriptionAr) metadata.description_ar = s.descriptionAr

      const body: CreateProductInput = {
        title: s.title.trim(), subtitle: s.subtitle.trim() || undefined,
        description: s.description.trim() || undefined, handle: s.handle || undefined,
        status: s.status, thumbnail: s.thumbnail || undefined,
        images: s.images.length > 0 ? s.images.map(url => ({ url })) : undefined,
        collection_id: s.collectionId || undefined,
        categories: s.categoryIds.length > 0 ? s.categoryIds.map(id => ({ id })) : undefined,
        type_id: s.typeId || undefined,
        tags: s.tags.length > 0 ? s.tags.map(value => ({ value })) : undefined,
        weight: s.weight ? Number(s.weight) : undefined, length: s.length ? Number(s.length) : undefined,
        width: s.width ? Number(s.width) : undefined, height: s.height ? Number(s.height) : undefined,
        hs_code: s.hsCode || undefined, material: s.material || undefined, origin_country: s.originCountry || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        options: s.options.length > 0 ? s.options.map(o => ({ title: o.title, values: o.values })) : undefined,
        variants: s.hasVariants && s.variants.length > 0
          ? s.variants.map(v => ({ title: Object.values(v.optionValues).join(' / '), sku: v.sku, barcode: v.barcode, prices: [{ currency_code: s.currencyCode, amount: v.price || priceAmount }], options: v.optionValues }))
          : priceAmount > 0
            ? [{ title: 'Default Title', sku: generateSKU(s.title, []), barcode: generateBarcode(s.title), prices: [{ currency_code: s.currencyCode, amount: priceAmount }] }]
            : undefined,
      }

      let saved: Product
      if (product) { saved = await updateProduct(product.id, body); toast.success('Product updated') }
      else { saved = await createProduct(body); toast.success('Product created!') }

      if (onSaved) onSaved(saved)
      else router.push(`/products/${saved.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  const addedPresetKeys = s.options.map(o => {
    const found = OPTION_PRESETS.find(p => p.labelEn === o.title || p.labelAr === o.title)
    return found?.key
  }).filter(Boolean)

  return (
    <div className="space-y-3">

      {/* ── General ──────────────────────────────────────── */}
      <Section title="General / المعلومات الأساسية" icon={Package} defaultOpen>
        <div className="space-y-5">
          <BiField
            label="Title / الاسم *"
            mainLang={mainLang}
            enValue={s.title} onEnChange={v => set('title', v)} enPlaceholder="Product title…"
            arValue={s.titleAr} onArChange={v => set('titleAr', v)} arPlaceholder="اسم المنتج…"
            onTranslate={makeTranslate('title', 'titleAr')}
          />
          <BiField
            label="Subtitle / العنوان الفرعي"
            mainLang={mainLang}
            enValue={s.subtitle} onEnChange={v => set('subtitle', v)} enPlaceholder="Optional subtitle…"
            arValue={s.subtitleAr} onArChange={v => set('subtitleAr', v)} arPlaceholder="عنوان فرعي…"
            onTranslate={makeTranslate('subtitle', 'subtitleAr')}
          />
          <BiField
            label="Description / الوصف"
            mainLang={mainLang}
            enValue={s.description} onEnChange={v => set('description', v)} enPlaceholder="Product description…"
            arValue={s.descriptionAr} onArChange={v => set('descriptionAr', v)} arPlaceholder="وصف المنتج…"
            multiline onTranslate={makeTranslate('description', 'descriptionAr')}
          />
          <Field label="Handle" hint="Auto-generated from title, used in URL">
            <input value={s.handle} onChange={e => set('handle', e.target.value)} placeholder="my-product" className={inp} dir="ltr" />
          </Field>
        </div>
      </Section>

      {/* ── Media ────────────────────────────────────────── */}
      <Section title="Media / الصور" icon={ImageIcon}>
        <div className="space-y-5">
          <Field label="Thumbnail / الصورة الرئيسية">
            <div onClick={() => !uploadingThumb && thumbInputRef.current?.click()}
              className="relative w-full aspect-video rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors">
              {s.thumbnail ? (
                <>
                  <img src={s.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  {uploadingThumb ? <Spinner /> : <><Camera className="w-8 h-8" /><span className="text-sm">Tap to upload / اضغط لرفع صورة</span></>}
                </div>
              )}
            </div>
            <input ref={thumbInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f) }} />
          </Field>
          <Field label="Additional Images / صور إضافية">
            <div className="space-y-2">
              {s.images.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                  <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <span className="flex-1 text-xs text-slate-500 truncate">{url.split('/').pop()}</span>
                  <div className="flex gap-1">
                    <button onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveImage(idx, 1)} disabled={idx === s.images.length - 1} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => set('images', s.images.filter((_, i) => i !== idx))} className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors"><X className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => imgInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                {uploadingImg ? <Spinner size="sm" /> : <><Plus className="w-4 h-4" />Add Images / إضافة صور</>}
              </button>
              <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) handleImgUpload(e.target.files) }} />
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Organize ─────────────────────────────────────── */}
      <Section title="Organize / التصنيف" icon={Tag}>
        <div className="space-y-4">
          <Field label="Status / الحالة">
            <div className="flex gap-2">
              {(['draft', 'published'] as const).map(st => (
                <button key={st} type="button" onClick={() => set('status', st)}
                  className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all', st === s.status ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500')}>
                  {st === 'draft' ? 'Draft / مسودة' : 'Published / منشور'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Product Type / النوع">
            <Select value={s.typeId} onChange={v => set('typeId', v)} options={typeOptions} placeholder="Select type… / اختر النوع" allowCreate onCreate={handleCreateType} createLabel="Create type" />
            <p className="text-xs text-slate-400 mt-1">e.g. Physical / منتج مادي · Digital / رقمي</p>
          </Field>
          <Field label="Collection / المجموعة">
            <Select value={s.collectionId} onChange={v => set('collectionId', v)} options={collectionOptions} placeholder="Select collection… / اختر المجموعة" allowCreate onCreate={handleCreateCollection} createLabel="Create collection" />
            <p className="text-xs text-slate-400 mt-1">e.g. Summer Sale / تخفيضات الصيف</p>
          </Field>
          <Field label="Categories / الفئات">
            <MultiSelect values={s.categoryIds} onChange={v => set('categoryIds', v)} options={categoryOptions} placeholder="Select categories… / اختر الفئات" allowCreate onCreate={handleCreateCategory} createLabel="Create category" />
            <p className="text-xs text-slate-400 mt-1">Multi-select · e.g. Clothing → Men / ملابس → رجالي</p>
          </Field>
          <Field label="Tags / الوسوم">
            <div className="flex flex-wrap gap-2 mb-2">
              {s.tags.map(t => (
                <span key={t} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {t}<button onClick={() => set('tags', s.tags.filter(x => x !== t))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Tag + Enter" className={`${inp} flex-1`} />
              <button onClick={addTag} className="px-3.5 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Shipping ─────────────────────────────────────── */}
      <Section title="Shipping / الشحن" icon={Truck}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Weight (g)"><input type="number" min="0" value={s.weight} onChange={e => set('weight', e.target.value)} placeholder="0" className={inp} /></Field>
            <Field label="Length (mm)"><input type="number" min="0" value={s.length} onChange={e => set('length', e.target.value)} placeholder="0" className={inp} /></Field>
            <Field label="Width (mm)"><input type="number" min="0" value={s.width} onChange={e => set('width', e.target.value)} placeholder="0" className={inp} /></Field>
            <Field label="Height (mm)"><input type="number" min="0" value={s.height} onChange={e => set('height', e.target.value)} placeholder="0" className={inp} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="HS Code"><input value={s.hsCode} onChange={e => set('hsCode', e.target.value)} placeholder="e.g. 6109.10" className={inp} /></Field>
            <Field label="Material"><input value={s.material} onChange={e => set('material', e.target.value)} placeholder="e.g. Cotton" className={inp} /></Field>
            <Field label="Origin Country"><input value={s.originCountry} onChange={e => set('originCountry', e.target.value)} placeholder="e.g. SA, US" className={inp} /></Field>
          </div>
        </div>
      </Section>

      {/* ── Has Variants toggle ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Product has variants / المنتج له متغيرات</p>
            <p className="text-xs text-slate-400 mt-0.5">e.g. different sizes, colors · مثال: مقاسات، ألوان مختلفة</p>
          </div>
          <button
            type="button"
            onClick={() => set('hasVariants', !s.hasVariants)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
              s.hasVariants ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              s.hasVariants ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* ── Options ──────────────────────────────────────── */}
      {s.hasVariants && <Section title="Options / الخيارات" icon={Layers}>
        <div className="space-y-4">
          {/* Quick presets */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick add / إضافة سريعة</p>
            <div className="flex flex-wrap gap-2">
              {OPTION_PRESETS.map(preset => {
                const added = addedPresetKeys.includes(preset.key)
                return (
                  <button
                    key={preset.key}
                    type="button"
                    disabled={added}
                    onClick={() => addOption(preset.labelEn, preset.values)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all',
                      added
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-400 cursor-not-allowed'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700'
                    )}
                  >
                    {added ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {preset.labelEn}
                    <span className="text-slate-400 font-normal">({preset.values.slice(0, 3).join(', ')}{preset.values.length > 3 ? '…' : ''})</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <p className="text-xs text-slate-400">
            Variants are auto-generated from all option combinations · المتغيرات تُولَّد تلقائياً
          </p>

          {/* Option cards */}
          {s.options.map(opt => (
            <OptionRow key={opt.id} opt={opt}
              onRemove={() => removeOption(opt.id)}
              onRename={title => renameOption(opt.id, title)}
              onAddValue={value => addOptionValue(opt.id, value)}
              onRemoveValue={value => removeOptionValue(opt.id, value)}
            />
          ))}

          {/* Add custom option */}
          <div className="flex gap-2 pt-1">
            <input value={newOptionTitle} onChange={e => setNewOptionTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (addOption(newOptionTitle), setNewOptionTitle(''))}
              placeholder="New option name / اسم خيار جديد (e.g. Size, Color)"
              className={`${inp} flex-1`} />
            <button onClick={() => { addOption(newOptionTitle); setNewOptionTitle('') }}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </Section>}

      {/* ── Pricing ──────────────────────────────────────── */}
      <Section title="Pricing / السعر" icon={DollarSign}>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Price / السعر">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{s.currencyCode.toUpperCase()}</span>
                  <input type="number" min="0" step="0.01" value={s.price} onChange={e => handlePriceChange(e.target.value)} placeholder="0.00" className={`${inp} pl-12`} />
                </div>
              </Field>
            </div>
            <div className="w-28">
              <Field label="Currency / العملة">
                <input value={s.currencyCode} onChange={e => set('currencyCode', e.target.value.toLowerCase())} placeholder="usd" className={inp} />
              </Field>
            </div>
          </div>
          {s.variants.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3.5 py-2.5">
              <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <p className="text-xs text-indigo-700 font-medium">
                Applied to all {s.variants.length} variants · مطبَّق على {s.variants.length} متغير
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Variants ─────────────────────────────────────── */}
      {s.variants.length > 0 && (
        <Section title={`Variants / المتغيرات (${s.variants.length})`} icon={Hash} defaultOpen>
          <div className="space-y-3">
            <p className="text-xs text-slate-400">SKU & Barcode auto-generated · تُولَّد تلقائياً. Stock is editable · الكمية قابلة للتعديل</p>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-slate-500 font-semibold">Variant</th>
                    <th className="text-left py-3 px-4 text-slate-500 font-semibold">SKU</th>
                    <th className="text-left py-3 px-4 text-slate-500 font-semibold">Barcode (EAN-13)</th>
                    <th className="text-center py-3 px-4 text-slate-500 font-semibold w-28">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {s.variants.map(v => (
                    <tr key={v.key} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{Object.values(v.optionValues).join(' / ')}</td>
                      <td className="py-3 px-4"><code className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{v.sku}</code></td>
                      <td className="py-3 px-4"><code className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{v.barcode}</code></td>
                      <td className="py-3 px-4 text-center">
                        <input type="number" min="0" value={v.stock}
                          onChange={e => updateVariantStock(v.key, parseInt(e.target.value) || 0)}
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {s.variants.map(v => (
                <div key={v.key} className="border border-slate-100 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{Object.values(v.optionValues).join(' / ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Stock</span>
                      <input type="number" min="0" value={v.stock}
                        onChange={e => updateVariantStock(v.key, parseInt(e.target.value) || 0)}
                        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">SKU</p>
                    <code className="block text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">{v.sku}</code>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1.5">Barcode</p>
                    <code className="block text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">{v.barcode}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Save */}
      <div className="pb-6">
        <Button variant="primary" size="lg" loading={saving} onClick={save}>
          {product ? 'Save Changes / حفظ التغييرات' : 'Create Product / إنشاء المنتج'}
        </Button>
      </div>
    </div>
  )
}
