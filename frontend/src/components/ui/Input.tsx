import { forwardRef, InputHTMLAttributes, ReactNode, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: ReactNode
  floating?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, floating = true, className, type, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const isPassword = type === 'password'
    const inputType = isPassword && showPassword ? 'text' : type

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && !floating && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-400">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            placeholder={floating ? ' ' : props.placeholder}
            className={cn(
              'peer w-full h-12 rounded-xl bg-surface-3/80 border text-slate-100 text-sm',
              'transition-all duration-200 outline-none',
              'placeholder:text-transparent focus:placeholder:text-slate-600',
              'border-border hover:border-slate-600',
              'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15',
              error && 'border-red-500/60 focus:border-red-500 focus:ring-red-500/15',
              icon ? 'pl-11 pr-4' : 'px-4',
              isPassword && 'pr-12',
              floating && label && 'pt-4 pb-1',
              props.disabled && 'opacity-60 cursor-not-allowed bg-surface-2',
              className
            )}
            {...props}
          />
          {floating && label && (
            <label
              htmlFor={inputId}
              className={cn(
                'absolute left-4 text-slate-500 pointer-events-none transition-all duration-200',
                'peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-indigo-400 peer-focus:font-medium',
                'peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-400',
                icon ? 'left-11 peer-focus:left-11 peer-[:not(:placeholder-shown)]:left-11' : '',
                'top-1/2 -translate-y-1/2 text-sm peer-focus:translate-y-0 peer-[:not(:placeholder-shown)]:translate-y-0'
              )}
            >
              {label}
            </label>
          )}
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-ink/5 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
