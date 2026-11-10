import { forwardRef, ReactNode, ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const variants = {
  primary:
    'bg-indigo-500 text-white shadow-button hover:bg-indigo-400 hover:shadow-glow border border-indigo-600/50',
  secondary:
    'bg-surface-2 text-slate-200 border border-border hover:bg-surface-3 hover:border-slate-600 shadow-sm',
  ghost: 'text-slate-300 hover:bg-ink/5 hover:text-slate-100 border border-transparent',
  outline:
    'bg-transparent text-slate-200 border border-slate-600/60 hover:border-indigo-500/60 hover:bg-indigo-500/5',
  danger:
    'bg-red-500 text-white border border-red-600/40 hover:bg-red-600 shadow-sm',
  success:
    'bg-emerald-500 text-white border border-emerald-600/40 hover:bg-emerald-600 shadow-sm',
}

const sizes = {
  sm: 'h-10 px-4 text-sm min-h-[40px]',
  md: 'h-12 px-5 text-sm min-h-[48px]',
  lg: 'h-14 px-7 text-base min-h-[56px]',
  icon: 'h-12 w-12 min-h-[48px] min-w-[48px] p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading,
      icon,
      iconRight,
      children,
      className,
      disabled,
      fullWidth,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
          'transition-all duration-200 select-none cursor-pointer',
          'hover:scale-[1.02] active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:scale-100',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    )
  }
)
Button.displayName = 'Button'
