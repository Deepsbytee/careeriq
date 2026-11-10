import { useState } from 'react'
import toast from 'react-hot-toast'
import { Copy, Sparkles } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { Button, Card } from '../ui'
import type { RewriteResult } from '../../lib/types'

interface Props {
  resumeId: string
  initial: RewriteResult | null
}

export function RewritePanel({ resumeId, initial }: Props) {
  const [data, setData] = useState<RewriteResult | null>(initial)
  const [loading, setLoading] = useState(false)

  const run = async (force = false) => {
    setLoading(true)
    try {
      const { data } = await api.post(`/resumes/${resumeId}/rewrite${force ? '?force=true' : ''}`)
      setData(data)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rewrite your bullets'))
    } finally {
      setLoading(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied')
    } catch {
      toast.error('Copy failed. Select the text and copy it yourself.')
    }
  }

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" aria-hidden /> Rewrite my weakest bullets
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            We pick the bullets with no figures, filler openings, or odd length, and suggest stronger versions.
            We never invent numbers: where a figure would help, you'll see a [placeholder] to fill in with the truth.
          </p>
        </div>
        <Button size="sm" variant={data ? 'outline' : 'primary'} loading={loading} onClick={() => run(!!data)}>
          {data ? 'Try again' : 'Rewrite bullets'}
        </Button>
      </div>

      {data && data.considered === 0 && (
        <p className="text-sm text-slate-400 mt-4">No weak bullet points found. Nothing to rewrite.</p>
      )}

      {data && data.rewrites.length > 0 && (
        <ul className="mt-5 space-y-4">
          {data.rewrites.map((r, i) => (
            <li key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-surface-3/60">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Before</p>
                <p className="text-sm text-slate-300">{r.original}</p>
              </div>
              <div className="px-4 py-3 bg-emerald-500/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-emerald-400 mb-1">After</p>
                    <p className="text-sm font-medium text-slate-100">{r.rewritten}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copy(r.rewritten)} aria-label="Copy rewritten bullet" icon={<Copy size={14} />} />
                </div>
                {r.why && <p className="text-xs text-slate-400 mt-2">{r.why}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.skipped > 0 && (
        <p className="text-xs text-slate-500 mt-4">
          {data.skipped} suggestion{data.skipped > 1 ? 's were' : ' was'} discarded because {data.skipped > 1 ? 'they' : 'it'} added numbers that aren't in your resume.
        </p>
      )}
    </Card>
  )
}
