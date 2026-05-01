import { cn } from '@/lib/utils'
export function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', color)}>
      {label}
    </span>
  )
}
