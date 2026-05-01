'use client'
import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption { value: string; label: string }

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  searchable?: boolean
  allowCreate?: boolean
  onCreate?: (value: string) => Promise<void> | void
  createLabel?: string
  disabled?: boolean
}

export function Select({ value, onChange, options, placeholder = 'Select…', searchable = true, allowCreate, onCreate, createLabel = 'Create', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = options.filter(o => !query || o.label.toLowerCase().includes(query.toLowerCase()))
  const showCreate = allowCreate && query.trim() && !options.find(o => o.label.toLowerCase() === query.toLowerCase())

  const handleCreate = async () => {
    if (!onCreate || !query.trim()) return
    setCreating(true)
    try { await onCreate(query.trim()) } finally { setCreating(false) }
    setQuery(''); setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm rounded-xl border transition-all bg-white text-left h-[46px]',
          open ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={selected ? 'text-slate-900 font-medium' : 'text-slate-400'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl z-[200] overflow-hidden">
          {searchable && (
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
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm hover:bg-slate-50 transition-colors">
              <span className={cn('flex-1 text-left', !value ? 'text-slate-900 font-semibold' : 'text-slate-400')}>{placeholder}</span>
              {!value && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
            </button>
            {filtered.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm hover:bg-slate-50 transition-colors">
                <span className={cn('flex-1 text-left', value === opt.value ? 'text-slate-900 font-semibold' : 'text-slate-700')}>{opt.label}</span>
                {value === opt.value && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && (
              <p className="text-center py-5 text-xs text-slate-400">No options found</p>
            )}
          </div>
          {showCreate && (
            <div className="border-t border-slate-100 p-2">
              <button type="button" onClick={handleCreate} disabled={creating}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
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
