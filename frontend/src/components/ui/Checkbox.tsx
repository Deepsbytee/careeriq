import { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

export function Checkbox({ checked, onChange, label, disabled, className, id }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-start gap-3 cursor-pointer group',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center',
          'transition-all duration-200 cursor-pointer',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30',
          checked
            ? 'bg-indigo-500 border-indigo-500 text-white'
            : 'border-border bg-surface-3 group-hover:border-slate-500'
        )}
      >
        {checked && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
            <Check size={12} strokeWidth={3} />
          </motion.span>
        )}
      </button>
      {label && <span className="text-sm text-slate-300 leading-snug">{label}</span>}
    </label>
  )
}
