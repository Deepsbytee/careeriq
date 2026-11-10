import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { Tooltip } from './Tooltip'

interface SidebarItemProps {
  to: string
  icon: ReactNode
  label: string
  collapsed?: boolean
  badge?: number
  onClick?: () => void
}

export function SidebarItem({ to, icon, label, collapsed, badge, onClick }: SidebarItemProps) {
  const content = (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
          'transition-all duration-200 group',
          isActive
            ? 'bg-indigo-500/15 text-slate-100'
            : 'text-slate-400 hover:text-slate-100 hover:bg-ink/5'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-indigo-500/15 border border-indigo-500/30"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className={cn('relative shrink-0', isActive && 'text-indigo-400')}>{icon}</span>
          {!collapsed && (
            <span className="relative flex-1 truncate">{label}</span>
          )}
          {!collapsed && badge !== undefined && badge > 0 && (
            <span className="relative ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-indigo-500 text-[10px] font-bold flex items-center justify-center">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        {content}
      </Tooltip>
    )
  }

  return content
}

interface NavbarProps {
  logo: ReactNode
  links?: { to: string; label: string }[]
  actions?: ReactNode
  className?: string
}

export function Navbar({ logo, links, actions, className }: NavbarProps) {
  return (
    <nav className={cn('sticky top-0 z-40 glass-strong border-b border-ink/5', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {logo}
        {links && (
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'text-slate-100 bg-ink/5' : 'text-slate-400 hover:text-slate-100'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </nav>
  )
}

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-2 text-xs text-slate-500 mb-3', className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-600">/</span>}
          {item.href ? (
            <NavLink to={item.href} className="hover:text-indigo-400 transition-colors">
              {item.label}
            </NavLink>
          ) : (
            <span className="text-slate-400">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
