import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, rows = 5, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-400">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            'w-full rounded-xl bg-surface-3/80 border border-border text-slate-100 text-sm px-4 py-3',
            'transition-all duration-200 outline-none resize-y min-h-[120px]',
            'placeholder:text-slate-600 hover:border-slate-600',
            'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15',
            error && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/15',
            props.disabled && 'opacity-60 cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
