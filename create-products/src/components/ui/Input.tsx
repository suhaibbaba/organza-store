import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900',
          'placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500',
          'transition-all',
          error && 'border-red-400 focus:border-red-400',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
