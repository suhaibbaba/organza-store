'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Barcode, Layers, Settings, ShoppingBag, Menu, X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/products', icon: Package, label: 'Products', labelAr: 'المنتجات' },
  { href: '/barcode', icon: Barcode, label: 'Barcode', labelAr: 'الباركود' },
  { href: '/stock', icon: Layers, label: 'Stock', labelAr: 'المخزون' },
  { href: '/settings', icon: Settings, label: 'Settings', labelAr: 'الإعدادات' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Desktop / Tablet Sidebar ──────────────────────── */}
      <aside className="hidden md:flex flex-col bg-slate-900 shadow-2xl z-30 w-16 lg:w-56 flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-3 lg:px-5 h-16 border-b border-slate-800">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block text-white font-bold text-sm tracking-tight truncate">Organza</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {links.map(({ href, icon: Icon, label }) => {
            const active = path.startsWith(href)
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block text-sm font-semibold">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <span className="hidden lg:block text-xs text-slate-400 truncate">Admin</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header bar */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 h-14 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Organza</span>
          </div>
          <button onClick={() => setMobileNavOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden bg-white border-t border-slate-100 flex-shrink-0 z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex">
            {links.map(({ href, icon: Icon, label }) => {
              const active = path.startsWith(href)
              return (
                <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors">
                  <Icon className={cn('w-5 h-5', active ? 'text-indigo-600' : 'text-slate-400')} />
                  <span className={cn('text-[10px] font-semibold', active ? 'text-indigo-600' : 'text-slate-400')}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Mobile drawer nav */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-64 bg-slate-900 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 border-b border-slate-800">
              <span className="text-white font-bold">Navigation</span>
              <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2">
              {links.map(({ href, icon: Icon, label }) => {
                const active = path.startsWith(href)
                return (
                  <Link key={href} href={href} onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold',
                      active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
