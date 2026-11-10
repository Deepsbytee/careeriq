import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import type { Category } from '../../lib/types'

const META: Record<string, { label: string; blurb: string }> = {
  structure: { label: 'Structure', blurb: 'Standard sections, dates, and a sensible length' },
  completeness: { label: 'Completeness', blurb: 'Contact details, links, education, and skills' },
  impact: { label: 'Impact', blurb: 'Measurable results and strong action verbs' },
  keywords: { label: 'Keywords and skills', blurb: 'Technical skills, and whether your work backs them up' },
  readability: { label: 'Readability', blurb: 'Concise bullets without filler or first-person phrasing' },
}

const barColor = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 40 ? 'bg-amber-500' : 'bg-red-500')

export function CategoryBars({ categories }: { categories: Record<string, Category> }) {
  return (
    <div className="space-y-4">
      {Object.entries(categories).map(([key, c], i) => {
        const meta = META[key] ?? { label: key, blurb: '' }
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-slate-100">{meta.label}</span>
                <span className="text-xs text-slate-500 ml-2">{Math.round(c.weight * 100)}% of score</span>
              </div>
              <span className="font-mono text-sm font-semibold text-slate-100">{Math.round(c.score)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden" role="img" aria-label={`${meta.label}: ${Math.round(c.score)} out of 100`}>
              <motion.div
                className={`h-full rounded-full ${barColor(c.score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${c.score}%` }}
                transition={{ duration: 0.8, delay: 0.08 * i, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {meta.blurb}
              {c.ai != null ? (
                <span className="text-slate-400"> · measured {Math.round(c.deterministic)}, AI review {Math.round(c.ai)}</span>
              ) : (
                <span className="text-slate-400"> · measured by rules</span>
              )}
            </p>
            {c.ai_reason && (
              <p className="text-xs text-slate-400 mt-1 flex gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5 text-slate-500" aria-hidden />
                <span>{c.ai_reason}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
