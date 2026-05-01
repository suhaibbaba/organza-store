export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return <div className={`${s} border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin`} />
}
