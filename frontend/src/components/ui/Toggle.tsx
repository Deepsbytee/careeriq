import { cn } from '../../lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center justify-between gap-4 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <span className="flex-1">
        {label && <span className="block text-sm font-medium text-slate-200">{label}</span>}
        {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 cursor-pointer',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30',
          checked ? 'bg-indigo-500' : 'bg-surface-3 border border-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </label>
  )
}
