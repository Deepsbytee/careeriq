import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center py-16 px-8 text-center gap-4', className)}
    >
      <div className="h-16 w-16 rounded-2xl bg-surface-3 border border-border flex items-center justify-center text-slate-500">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-slate-100 mb-1">{title}</p>
        <p className="text-sm text-slate-400 max-w-sm">{description}</p>
      </div>
      {action}
    </motion.div>
  )
}

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-r from-surface-3 via-surface-2 to-surface-3 bg-[length:200%_100%] animate-shimmer',
        className
      )}
    />
  )
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn('rounded-full border-2 border-border border-t-indigo-500 animate-spin', className)}
      style={{ width: size, height: size }}
    />
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  color,
  showLabel,
  size = 'sm',
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  const barColor =
    color ||
    (pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500')

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Progress</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full bg-surface-3 overflow-hidden',
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor.startsWith('bg-') ? barColor : '')}
          style={!barColor.startsWith('bg-') ? { background: barColor } : undefined}
        />
      </div>
    </div>
  )
}
