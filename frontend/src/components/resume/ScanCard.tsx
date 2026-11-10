import { Check, AlertTriangle, Eye } from 'lucide-react'
import { Card, Badge } from '../ui'
import type { Scan } from '../../lib/types'

const SIGNALS: [keyof Scan['signals'], string][] = [
  ['email', 'Email'], ['phone', 'Phone'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'],
]

export function ScanCard({ scan }: { scan: Scan }) {
  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={16} className="text-indigo-400" aria-hidden />
        <h3 className="font-semibold text-slate-100">What a recruiter sees in 6 seconds</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">A quick skim picks up a few things. This is what yours gives away. Measured by rules, not guessed.</p>

      <dl className="grid sm:grid-cols-3 gap-4 mb-5">
        {[
          ['Name', scan.name],
          ['Latest role', scan.latest_role],
          ['Education', scan.education],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{k}</dt>
            <dd className={v ? 'text-sm font-medium text-slate-100' : 'text-sm text-slate-500 italic'}>{v || 'Not obvious'}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Skills that stand out</p>
        <div className="flex flex-wrap gap-1.5">
          {scan.top_skills.length ? scan.top_skills.map(s => <Badge key={s} variant="indigo">{s}</Badge>) : (
            <span className="text-sm text-slate-500 italic">None recognised</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5">
        {SIGNALS.map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-sm">
            {scan.signals[key]
              ? <Check size={15} className="text-emerald-400" aria-label="present" />
              : <AlertTriangle size={15} className="text-red-400" aria-label="missing" />}
            <span className={scan.signals[key] ? 'text-slate-200' : 'text-slate-400'}>{label}</span>
          </span>
        ))}
      </div>

      <ul className="space-y-2">
        {scan.notes.map((n, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-300">
            {n.kind === 'good'
              ? <Check size={16} className="shrink-0 mt-0.5 text-emerald-400" aria-label="good" />
              : <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" aria-label="needs attention" />}
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
