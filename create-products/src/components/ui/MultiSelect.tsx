'use client'
import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
  parentId?: string | null
  depth?: number
}

interface Props {
  values: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  allowCreate?: boolean
  onCreate?: (label: string) => Promise<void> | void
  createLabel?: string
}

export function MultiSelect({ values, onChange, options, placeholder = 'Select…', allowCreate, onCreate, createLabel = 'Create' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const toggle = (val: string) =>
    onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val])

  const filtered = options.filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
  const selectedLabels = values.map(v => options.find(o => o.value === v)?.label).filter(Boolean) as string[]
  const showCreate = allowCreate && query.trim() && !options.find(o => o.label.toLowerCase() === query.toLowerCase())

  const handleCreate = async () => {
    if (!onCreate || !query.trim()) return
    setCreating(true)
    try { await onCreate(query.trim()) } finally { setCreating(false) }
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl border transition-all bg-white text-left min-h-[46px]',
          open ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
          {selectedLabels.length === 0
            ? <span className="text-slate-400 text-sm">{placeholder}</span>
            : selectedLabels.map((label, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0">
                {label}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggle(values[i]) }}
                  className="hover:text-indigo-900 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          }
        </div>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* Dropdown — rendered in portal-style absolute, zIndex high */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[200] overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 sticky top-0 bg-white">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-sm outline-none placeholder-slate-400 bg-transparent"
            />
          </div>
          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map(opt => {
              const checked = values.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  style={{ paddingLeft: `${14 + (opt.depth || 0) * 14}px` }}
                  className="w-full flex items-center gap-3 pr-3.5 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                  )}>
                    {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className={cn('text-left flex-1', checked ? 'text-slate-900 font-semibold' : 'text-slate-700')}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && !showCreate && (
              <p className="text-center py-5 text-xs text-slate-400">No options found</p>
            )}
          </div>
          {/* Create */}
          {showCreate && (
            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                {createLabel} &ldquo;{query.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
