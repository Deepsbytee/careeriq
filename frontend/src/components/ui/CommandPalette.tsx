import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FileText, Briefcase, UserCheck, MessageSquare,
  Github, BarChart2, Settings, Search, ArrowRight,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const COMMANDS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, group: 'Pages' },
  { label: 'Resume Lab', to: '/resume-lab', icon: FileText, group: 'Pages' },
  { label: 'Job Match', to: '/job-match', icon: Briefcase, group: 'Pages' },
  { label: 'Recruiter view', to: '/recruiter', icon: UserCheck, group: 'Pages' },
  { label: 'Interview Prep', to: '/interview-prep', icon: MessageSquare, group: 'Pages' },
  { label: 'Portfolio', to: '/portfolio', icon: Github, group: 'Pages' },
  { label: 'Analytics', to: '/analytics', icon: BarChart2, group: 'Pages' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'Pages' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const navigate = useNavigate()

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  const run = useCallback(
    (to: string) => {
      navigate(to)
      onClose()
      setQuery('')
    },
    [navigate, onClose]
  )

  useEffect(() => {
    if (!open) return
    setSelected(0)
    setQuery('')
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open ? onClose() : undefined
      }
      if (!open) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && filtered[selected]) {
        run(filtered[selected].to)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, selected, onClose, run])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative w-full max-w-lg rounded-2xl glass-strong border border-ink/10 shadow-card overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-ink/5">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(0) }}
                placeholder="Search pages..."
                className="flex-1 h-14 bg-transparent text-slate-100 text-sm outline-none placeholder:text-slate-600"
              />
              <kbd className="hidden sm:inline text-[10px] text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-border">
                ESC
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No results found</p>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.to}
                    type="button"
                    onClick={() => run(cmd.to)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-sm cursor-pointer transition-colors',
                      i === selected ? 'bg-indigo-500/15 text-slate-100' : 'text-slate-300 hover:bg-ink/5'
                    )}
                  >
                    <cmd.icon size={16} className="text-slate-400 shrink-0" />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    <ArrowRight size={14} className="text-slate-600" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen, onClose: () => setOpen(false) }
}
