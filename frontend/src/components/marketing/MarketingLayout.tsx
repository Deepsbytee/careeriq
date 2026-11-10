import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ArrowRight } from 'lucide-react'
import { Navbar, Button } from '../ui'

interface MarketingLayoutProps {
  children: ReactNode
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-surface text-slate-100 overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl"
        />
      </div>

      <Navbar
        logo={
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
              <Zap size={15} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">CareerIQ</span>
          </Link>
        }
        links={[
          { to: '/features', label: 'Features' },
          { to: '/pricing', label: 'Pricing' },
        ]}
        actions={
          <>
            <Link to="/login">
              <Button variant="ghost" size="md">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="md" iconRight={<ArrowRight size={15} />}>Get started</Button>
            </Link>
          </>
        }
      />

      <div className="relative">{children}</div>

      <footer className="relative border-t border-ink/5 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 gap-8 mb-10 max-w-md">
            {[
              { title: 'Product', links: [['Features', '/features'], ['Pricing', '/pricing'], ['Sign in', '/login']] },
              { title: 'Trust', links: [['How your data is handled', '/privacy']] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-slate-100 mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link to={href} className="text-sm text-slate-500 hover:text-indigo-400 transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-ink/5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Zap size={14} className="text-indigo-400" />
              CareerIQ © {new Date().getFullYear()}
            </div>
            <p className="text-xs text-slate-600">Honest resume feedback, with the evidence.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
