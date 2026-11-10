import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  breadcrumb?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, action, breadcrumb, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8', className)}
    >
      <div>
        {breadcrumb}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  )
}

interface StepIndicatorProps {
  steps: string[]
  current: number
  className?: string
}

export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap mb-8', className)}>
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < current && 'bg-emerald-500 text-white',
              i === current && 'bg-indigo-500 text-white shadow-glow',
              i > current && 'bg-surface-3 border border-border text-slate-500'
            )}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={cn(
              'text-sm font-medium',
              i === current ? 'text-slate-100' : 'text-slate-500'
            )}
          >
            {step}
          </span>
          {i < steps.length - 1 && (
            <div className={cn('w-8 h-px mx-1', i < current ? 'bg-emerald-500/50' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  )
}
