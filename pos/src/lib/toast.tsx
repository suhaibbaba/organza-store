import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: string
  message: string
  color: 'green' | 'red' | 'blue' | 'default'
  autoClose?: number
  exiting?: boolean
}

interface ToastCtx {
  show: (opts: { message: string; color?: Toast['color']; autoClose?: number }) => void
}

const ToastContext = createContext<ToastCtx>({ show: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 220)
  }, [])

  const show = useCallback(({ message, color = 'default', autoClose = 3000 }: {
    message: string; color?: Toast['color']; autoClose?: number
  }) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { id, message, color, autoClose }])
    if (autoClose && autoClose > 0) {
      const t = setTimeout(() => dismiss(id), autoClose)
      timers.current.set(id, t)
    }
  }, [dismiss])

  // Cleanup
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const colorCls: Record<string, string> = {
    green: 'bg-green-600 text-white',
    red:   'bg-red-600 text-white',
    blue:  'bg-blue-600 text-white',
    default: 'bg-gray-800 text-white',
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ minWidth: 260, maxWidth: 420 }}>
          {toasts.map(t => (
            <div
              key={t.id}
              className={`${colorCls[t.color] || colorCls.default} px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
              onClick={() => dismiss(t.id)}
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/** Drop-in replacement for @mantine/notifications `notifications` object */
export const notifications = {
  _ctx: null as ToastCtx | null,
  show(opts: { message: string; color?: Toast['color']; autoClose?: number }) {
    notifications._ctx?.show(opts)
  },
}

/** Call once inside ToastProvider to wire up the static `notifications` object */
export function useRegisterNotifications() {
  const ctx = useToast()
  notifications._ctx = ctx
}
