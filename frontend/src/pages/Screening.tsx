import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { AlertTriangle, ChevronDown, FileText, Info, Lock, Trash2, Upload, Users } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Textarea } from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import { cn } from '../lib/utils'
import type { Candidate, ScreeningResult } from '../lib/types'

const MAX_FILES = 15
const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

const tone = (s: number) => (s >= 70 ? 'bg-emerald-500' : s >= 45 ? 'bg-amber-500' : 'bg-red-500')

function CandidateRow({ c }: { c: Candidate }) {
  const [open, setOpen] = useState(c.rank === 1)
  return (
    <li className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full grid grid-cols-[2.5rem_1fr_auto_1.5rem] sm:grid-cols-[2.5rem_1fr_10rem_5rem_1.5rem] items-center gap-3 px-4 py-4 text-left hover:bg-surface-1 transition-colors"
        aria-expanded={open}
      >
        <span className="font-mono text-sm text-slate-500">#{c.rank}</span>
        <div className="min-w-0">
          <p className="font-medium text-slate-100 truncate">{c.name}</p>
          <p className="text-xs text-slate-500 truncate">{c.filename}</p>
        </div>
        <div className="hidden sm:block">
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden" role="img" aria-label={`Fit ${c.fit_score} out of 100`}>
            <div className={cn('h-full rounded-full', tone(c.fit_score))} style={{ width: `${c.fit_score}%` }} />
          </div>
        </div>
        <span className="font-mono text-lg font-semibold text-slate-100 text-right">{Math.round(c.fit_score)}</span>
        <ChevronDown size={16} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="px-4 pb-5 pl-4 sm:pl-[4.25rem] grid md:grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Has {c.matched_skills.length} required skills ({c.skill_coverage}%)</p>
            <div className="flex flex-wrap gap-1.5">
              {c.matched_skills.length ? c.matched_skills.map(s => <Badge key={s} color="green">{s}</Badge>) : <span className="text-xs text-slate-500">None of the required skills</span>}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Missing</p>
            <div className="flex flex-wrap gap-1.5">
              {c.missing_skills.length ? c.missing_skills.map(s => <Badge key={s} color="red">{s}</Badge>) : <span className="text-xs text-slate-500">Nothing missing</span>}
            </div>
          </div>
          {c.extra_skills.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Also lists</p>
              <div className="flex flex-wrap gap-1.5">{c.extra_skills.map(s => <Badge key={s}>{s}</Badge>)}</div>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Resume quality {Math.round(c.resume_quality)}/100</p>
            {c.flags.length ? (
              <ul className="space-y-1">
                {c.flags.map(f => (
                  <li key={f} className="text-xs text-slate-400 flex gap-1.5"><AlertTriangle size={12} className="mt-0.5 text-amber-400 shrink-0" aria-hidden />{f}</li>
                ))}
              </ul>
            ) : <span className="text-xs text-slate-500">No warnings</span>}
          </div>
        </div>
      )}
    </li>
  )
}

export default function Screening() {
  const { user } = useAuthStore()
  const [title, setTitle] = useState('')
  const [jd, setJd] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScreeningResult | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name + f.size))
      const merged = [...prev, ...accepted.filter(f => !names.has(f.name + f.size))]
      if (merged.length > MAX_FILES) toast.error(`Only the first ${MAX_FILES} resumes are kept.`)
      return merged.slice(0, MAX_FILES)
    })
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT })

  if (user && user.role === 'candidate') {
    return (
      <PageTransition>
        <PageHeader title="Screening" />
        <Card padding="lg">
          <EmptyState icon={<Lock size={26} />} title="For recruiter accounts"
            description="Screening ranks many resumes against a job description. It's available to recruiter and admin accounts." />
        </Card>
      </PageTransition>
    )
  }

  const run = async () => {
    setLoading(true)
    setResult(null)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    fd.append('job_title', title)
    fd.append('job_description', jd)
    try {
      const { data } = await api.post('/screening/rank', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rank those resumes'))
    } finally {
      setLoading(false)
    }
  }

  const ready = files.length > 0 && title.trim().length > 0 && jd.trim().length > 0

  return (
    <PageTransition>
      <PageHeader
        title="Screening"
        subtitle="Upload resumes, paste the job description, and get a ranked shortlist with the reasons. Rule-based, so the same input always gives the same ranking, and nothing is stored."
      />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold">The role</h2>
          <Input label="Job title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Backend Engineer" />
          <Textarea label="Job description" value={jd} onChange={e => setJd(e.target.value)} rows={9}
            placeholder="Paste the full posting, including the required skills and tools." />
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold mb-4">The resumes <span className="text-sm font-normal text-slate-500">({files.length}/{MAX_FILES})</span></h2>
          <div
            {...getRootProps()}
            className={cn(
              'rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-border hover:border-indigo-500/50 hover:bg-indigo-500/5'
            )}
          >
            <input {...getInputProps()} />
            <Upload size={24} className="mx-auto mb-2 text-indigo-400" aria-hidden />
            <p className="text-sm font-medium text-slate-100">Drop resumes here, or click to choose</p>
            <p className="text-xs text-slate-500 mt-1">PDF, DOCX or TXT, up to 5 MB each</p>
          </div>
          {files.length > 0 && (
            <ul className="mt-4 space-y-1.5 max-h-48 overflow-y-auto">
              {files.map(f => (
                <li key={f.name + f.size} className="flex items-center gap-2 text-sm rounded-lg bg-surface-3/60 px-3 py-2">
                  <FileText size={14} className="text-slate-500 shrink-0" aria-hidden />
                  <span className="truncate flex-1 text-slate-300">{f.name}</span>
                  <button onClick={() => setFiles(p => p.filter(x => x !== f))} aria-label={`Remove ${f.name}`} className="text-slate-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex justify-end mb-8">
        <Button size="lg" icon={<Users size={18} />} loading={loading} disabled={!ready} onClick={run}>Rank candidates</Button>
      </div>

      {result && (
        <div className="space-y-6">
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-3">Required skills found in the posting</h2>
            <div className="flex flex-wrap gap-1.5 mb-4">{result.required_skills.map(s => <Badge key={s} variant="indigo">{s}</Badge>)}</div>
            <p className="text-xs text-slate-500 flex gap-1.5"><Info size={13} className="shrink-0 mt-0.5" aria-hidden />{result.method} Skills are matched against a built-in list, so a requirement outside that list isn't scored. Use this to prioritise, then read the resumes.</p>
          </Card>

          <Card padding="none">
            <h2 className="text-lg font-semibold px-4 pt-5 pb-3">Ranked candidates ({result.candidates.length})</h2>
            {result.candidates.length ? (
              <ul>{result.candidates.map(c => <CandidateRow key={c.filename} c={c} />)}</ul>
            ) : (
              <p className="px-4 pb-6 text-sm text-slate-500">None of the uploaded files could be ranked.</p>
            )}
          </Card>

          {result.rejected.length > 0 && (
            <Card padding="lg">
              <h2 className="text-lg font-semibold mb-3">Not ranked ({result.rejected.length})</h2>
              <ul className="space-y-2">
                {result.rejected.map(r => (
                  <li key={r.filename} className="text-sm flex gap-2">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden />
                    <span><span className="font-medium text-slate-200">{r.filename}</span> <span className="text-slate-400">· {r.reason}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </PageTransition>
  )
}
