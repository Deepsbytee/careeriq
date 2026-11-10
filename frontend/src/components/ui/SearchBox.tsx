import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  onClear,
}: SearchBoxProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-12 pl-11 pr-10 rounded-xl bg-surface-3/80 border border-border',
          'text-sm text-slate-100 placeholder:text-slate-600',
          'transition-all duration-200 outline-none',
          'hover:border-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            onClear?.()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-ink/5 cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
