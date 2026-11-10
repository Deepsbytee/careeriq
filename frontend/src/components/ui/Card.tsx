import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({ children, className, hover, glass = true, padding = 'md', onClick }: CardProps) {
  const Component = hover || onClick ? motion.div : 'div'
  const motionProps = hover || onClick
    ? {
        whileHover: hover ? { y: -2, transition: { duration: 0.2 } } : undefined,
        onClick,
        className: cn(onClick && 'cursor-pointer'),
      }
    : {}

  return (
    <Component
      {...motionProps}
      className={cn(
        'rounded-2xl border border-ink/[0.06] overflow-hidden',
        glass ? 'glass' : 'bg-surface-2',
        hover && 'transition-shadow hover:shadow-glow hover:border-indigo-500/20',
        paddingMap[padding],
        className
      )}
    >
      {children}
    </Component>
  )
}

interface StatsCardProps {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  className?: string
}

export function StatsCard({ label, value, change, trend, icon, className }: StatsCardProps) {
  const trendColor =
    trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'

  return (
    <Card hover className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-100">{value}</p>
          {change && <p className={cn('text-xs mt-1.5 font-medium', trendColor)}>{change}</p>}
        </div>
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
