import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

export interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: string
  className?: string
  disabled?: boolean
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  className,
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)} ref={ref}>
      {label && <span className="text-sm font-medium text-slate-400">{label}</span>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          className={cn(
            'w-full h-12 px-4 rounded-xl bg-surface-3/80 border border-border',
            'flex items-center justify-between gap-2 text-sm text-left',
            'transition-all duration-200 cursor-pointer',
            'hover:border-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15',
            open && 'border-indigo-500 ring-4 ring-indigo-500/15',
            error && 'border-red-500/60',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          <span className={cn('truncate', !selected && 'text-slate-500')}>
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.icon}
                {selected.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown
            size={16}
            className={cn('text-slate-500 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 py-1.5 rounded-xl bg-surface-2 border border-border shadow-card overflow-hidden"
            >
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2.5 flex items-center gap-2.5 text-sm text-left cursor-pointer',
                    'transition-colors hover:bg-indigo-500/10',
                    value === opt.value && 'bg-indigo-500/15 text-indigo-300'
                  )}
                >
                  {opt.icon}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {value === opt.value && <Check size={14} className="text-indigo-400 shrink-0" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
