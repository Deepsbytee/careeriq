import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'indigo'
  color?: BadgeProps['variant']
  size?: 'sm' | 'md'
  className?: string
}

const variants = {
  default: 'bg-surface-3 text-slate-400 border-border',
  green: 'bg-success-dim text-emerald-400 border-emerald-500/20',
  yellow: 'bg-warning-dim text-yellow-400 border-yellow-500/20',
  red: 'bg-danger-dim text-red-400 border-red-500/20',
  blue: 'bg-info-dim text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  indigo: 'bg-accent-dim text-indigo-300 border-indigo-500/20',
}

export function Badge({ children, variant, color, size = 'sm', className }: BadgeProps) {
  const v = color || variant || 'default'
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-lg border',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        variants[v],
        className
      )}
    >
      {children}
    </span>
  )
}

// Alias for backward compat
export type BadgeColor = BadgeProps['variant']
