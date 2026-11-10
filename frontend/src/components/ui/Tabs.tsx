import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 p-1 rounded-xl bg-surface-3/80 border border-border', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'transition-all duration-200 cursor-pointer min-h-[44px]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
            active === tab.id
              ? 'bg-indigo-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-100 hover:bg-ink/5'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
