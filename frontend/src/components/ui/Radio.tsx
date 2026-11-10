import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface RadioProps {
  checked: boolean
  onChange: () => void
  label?: ReactNode
  description?: string
  disabled?: boolean
  className?: string
  icon?: ReactNode
}

export function Radio({ checked, onChange, label, description, disabled, className, icon }: RadioProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange()}
      className={cn(
        'w-full flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30',
        checked
          ? 'border-indigo-500/60 bg-indigo-500/10 shadow-glow'
          : 'border-border bg-surface-3/50 hover:border-slate-600 hover:bg-surface-3',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center',
          checked ? 'border-indigo-500' : 'border-slate-600'
        )}
      >
        {checked && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-2.5 w-2.5 rounded-full bg-indigo-500"
          />
        )}
      </span>
      {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        {label && <span className="block text-sm font-medium text-slate-200">{label}</span>}
        {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
      </span>
    </button>
  )
}

interface RadioGroupProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function RadioGroup({ value, onChange, children, className }: RadioGroupProps) {
  return (
    <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>
      {Array.isArray(children)
        ? children.map((child, i) => {
            if (child && typeof child === 'object' && 'props' in child) {
              const props = (child as React.ReactElement).props as RadioProps & { value?: string }
              if (props.value !== undefined) {
                return (
                  <Radio
                    key={props.value || i}
                    {...props}
                    checked={value === props.value}
                    onChange={() => onChange(props.value!)}
                  />
                )
              }
            }
            return child
          })
        : children}
    </div>
  )
}
