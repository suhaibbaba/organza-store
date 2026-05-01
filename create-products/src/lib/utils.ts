import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

export function statusColor(status: string): string {
  switch (status) {
    case 'published': return 'bg-emerald-100 text-emerald-700'
    case 'draft': return 'bg-slate-100 text-slate-600'
    case 'proposed': return 'bg-amber-100 text-amber-700'
    default: return 'bg-red-100 text-red-600'
  }
}
