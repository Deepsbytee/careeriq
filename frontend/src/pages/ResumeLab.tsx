import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Check, Download, FileText, History,
  RotateCcw, ShieldCheck, Trash2, TrendingUp, AlertTriangle, Upload,
} from 'lucide-react'
import { api, downloadFile, errorMessage } from '../lib/api'
import { Badge, Button, Card, FileUpload, PageHeader, ProgressBar, ScoreRing, Spinner } from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import { CategoryBars } from '../components/resume/CategoryBars'
import { ResumeViewer, type Mark } from '../components/resume/ResumeViewer'
import { RewritePanel } from '../components/resume/RewritePanel'
import { ScanCard } from '../components/resume/ScanCard'
import type { Analysis, Evidence, ResumeDetail, ResumeSummary, Scan } from '../lib/types'

type Step = 'home' | 'processing' | 'result' | 'error'
type Stage = 'validating' | 'analyzing'

const verdict = (s: number) => (s >= 75 ? 'Strong' : s >= 55 ? 'Solid foundation' : 'Needs work')
const fmtDate = (iso: string) => new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function ResumeLab() {
  const [step, setStep] = useState<Step>('home')
  const [stage, setStage] = useState<Stage>('validating')
  const [filename, setFilename] = useState('')
  const [errorText, setErrorText] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [resume, setResume] = useState<ResumeDetail | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [activeMark, setActiveMark] = useState<string | null>(null)
  const [history, setHistory] = useState<Analysis[]>([])
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [busy, setBusy] = useState<'pdf' | 'rerun' | 'delete' | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.get('/resumes/analyses'), api.get('/resumes/')])
      setHistory(a.data)
      setResumes(r.data)
    } catch { /* history is a convenience; the page still works without it */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const nameOf = (id: string) => resumes.find(r => r.id === id)?.filename ?? 'Resume'

  const open = useCallback(async (a: Analysis) => {
    const [res, sc] = await Promise.allSettled([api.get(`/resumes/${a.resume_id}`), api.get(`/resumes/${a.resume_id}/scan`)])
    setAnalysis(a)
    setResume(res.status === 'fulfilled' ? res.value.data : null)
    setScan(sc.status === 'fulfilled' ? sc.value.data : null)
    setFilename(res.status === 'fulfilled' ? res.value.data.filename : '')
    setActiveMark(null)
    setStep('result')
  }, [])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setFilename(file.name)
    setStage('validating')
    setStep('processing')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data: up } = await api.post('/resumes/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setStage('analyzing')
      const { data: anal } = await api.post(`/resumes/${up.id}/analyze`)
      await open(anal)
      loadHistory()
    } catch (err) {
      const msg = errorMessage(err, 'We could not analyze that file.')
      setErrorText(msg)
      setStep('error')
    }
  }, [open, loadHistory])

  const previous = useMemo(() => {
    if (!analysis) return null
    const t = new Date(analysis.created_at).getTime()
    return history
      .filter(h => h.id !== analysis.id && new Date(h.created_at).getTime() < t)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null
  }, [analysis, history])

  const marks: Mark[] = useMemo(() => {
    if (!analysis?.evidence) return []
    const pick = (items: Evidence[], kind: Mark['kind'], p: string): Mark[] =>
      items.filter(e => e.evidence).map((e, i) => ({ id: `${p}${i}`, quote: e.evidence!, kind }))
    return [...pick(analysis.evidence.strengths, 'good', 's'), ...pick(analysis.evidence.weaknesses, 'warn', 'w')]
  }, [analysis])

  const download = async () => {
    if (!analysis) return
    setBusy('pdf')
    try { await downloadFile(`/resumes/analyses/${analysis.id}/report.pdf`, `careeriq-report-${analysis.id.slice(0, 8)}.pdf`) }
    catch (err) { toast.error(errorMessage(err, 'Could not create the report')) }
    finally { setBusy(null) }
  }

  const rerun = async () => {
    if (!analysis) return
    setBusy('rerun')
    try {
      const { data } = await api.post(`/resumes/${analysis.resume_id}/analyze?force=true`)
      await open(data)
      loadHistory()
      toast.success('Fresh analysis complete')
    } catch (err) { toast.error(errorMessage(err, 'Could not re-run the analysis')) }
    finally { setBusy(null) }
  }

  const remove = async () => {
    if (!analysis || !window.confirm('Delete this resume and all its analyses? This cannot be undone.')) return
    setBusy('delete')
    try {
      await api.delete(`/resumes/${analysis.resume_id}`)
      toast.success('Resume deleted')
      setStep('home')
      loadHistory()
    } catch (err) { toast.error(errorMessage(err, 'Could not delete the resume')) }
    finally { setBusy(null) }
  }

  const reset = () => { setStep('home'); setAnalysis(null); setResume(null); setScan(null); setErrorText('') }
  const delta = analysis && previous ? Math.round((analysis.ats_score - previous.ats_score) * 10) / 10 : null

  return (
    <PageTransition>
      <PageHeader
        title="Resume Lab"
        subtitle="Upload your resume for a scored review. Every number is explained, and every quote is checked against your actual text."
        action={step === 'result' ? <Button variant="outline" icon={<Upload size={15} />} onClick={reset}>Analyze another</Button> : undefined}
      />

      {step === 'home' && (
        <div className="space-y-8">
          <div className="max-w-2xl mx-auto">
            <FileUpload onDrop={onDrop} />
            <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-1.5">
              <ShieldCheck size={13} aria-hidden /> Only resumes are accepted. Other documents are rejected before analysis.
            </p>
          </div>

          {history.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><History size={17} aria-hidden /> Your analyses</h2>
              <div className="space-y-2">
                {history.slice(0, 6).map(h => (
                  <button
                    key={h.id}
                    onClick={() => open(h)}
                    className="w-full text-left rounded-xl border border-border bg-surface-2 hover:border-indigo-500/40 hover:bg-surface-1 transition-colors px-4 py-3 flex items-center gap-4"
                  >
                    <FileText size={18} className="text-slate-500 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-100 truncate">{nameOf(h.resume_id)}</p>
                      <p className="text-xs text-slate-500">{fmtDate(h.created_at)}</p>
                    </div>
                    <span className="font-mono text-lg font-semibold text-slate-100">{Math.round(h.ats_score)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="max-w-md mx-auto text-center py-16" role="status" aria-live="polite">
          <Spinner size={36} className="mx-auto mb-6 text-indigo-400" />
          <h2 className="text-xl font-semibold mb-1">{stage === 'validating' ? 'Checking your file' : 'Reviewing your resume'}</h2>
          <p className="text-sm text-slate-400 mb-6 truncate">{filename}</p>
          <ProgressBar value={stage === 'validating' ? 30 : 75} />
          <p className="text-xs text-slate-500 mt-4">
            {stage === 'validating' ? 'Making sure it is a readable resume.' : 'Scoring it and checking every quote. This takes 10 to 30 seconds.'}
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="max-w-md mx-auto text-center py-16" role="alert">
          <AlertCircle size={44} className="text-red-400 mx-auto mb-4" aria-hidden />
          <h2 className="font-semibold text-xl mb-2">We couldn't analyze that file</h2>
          <p className="text-slate-400 text-sm mb-6">{errorText}</p>
          <Button onClick={reset} icon={<RotateCcw size={14} />}>Try again</Button>
        </div>
      )}

      {step === 'result' && analysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Score header */}
          <Card padding="lg" className="gradient-border">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={Math.round(analysis.ats_score)} label="ATS score" size={132} />
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                  <h2 className="text-2xl font-semibold">{verdict(analysis.ats_score)}</h2>
                  {analysis.score_breakdown?.career_level && <Badge variant="indigo">{analysis.score_breakdown.career_level}</Badge>}
                  {delta != null && delta !== 0 && (
                    <Badge variant={delta > 0 ? 'green' : 'red'}>
                      {delta > 0 ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
                      {delta > 0 ? '+' : ''}{delta} since {fmtDate(previous!.created_at)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400 mb-1 truncate">{filename}</p>
                {analysis.summary && <p className="text-sm text-slate-300 max-w-2xl">{analysis.summary}</p>}
              </div>
              <div className="flex md:flex-col gap-2 no-print">
                <Button size="sm" icon={<Download size={14} />} loading={busy === 'pdf'} onClick={download}>PDF report</Button>
                <Button size="sm" variant="outline" icon={<RotateCcw size={14} />} loading={busy === 'rerun'} onClick={rerun}>Re-run</Button>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} loading={busy === 'delete'} onClick={remove}>Delete</Button>
              </div>
            </div>
          </Card>

          {/* Breakdown */}
          {analysis.score_breakdown ? (
            <Card padding="lg">
              <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-indigo-400" aria-hidden /> Where your score comes from</h3>
              <p className="text-xs text-slate-500 mb-5">
                Structure and completeness are measured by rules. Impact, keywords and readability are half measured, half AI-rated.
                The same resume always gets the same measured numbers.
              </p>
              <CategoryBars categories={analysis.score_breakdown.categories} />
            </Card>
          ) : (
            <Card padding="md">
              <p className="text-sm text-slate-400">This analysis was made before score breakdowns existed. Press Re-run for the full version.</p>
            </Card>
          )}

          {scan && <ScanCard scan={scan} />}

          {/* Strengths and weaknesses with evidence */}
          <div className="grid lg:grid-cols-2 gap-6">
            {([
              ["What's working", 'good', analysis.evidence?.strengths, analysis.strengths, 's'],
              ['What to improve', 'warn', analysis.evidence?.weaknesses, analysis.weaknesses, 'w'],
            ] as const).map(([title, kind, ev, plain, prefix]) => {
              const items: Evidence[] = ev ?? (plain ?? []).map(p => ({ point: p, evidence: null, verified: null }))
              let qi = -1
              return (
                <Card key={title} padding="lg">
                  <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    {kind === 'good' ? <Check size={16} className="text-emerald-400" aria-hidden /> : <AlertTriangle size={16} className="text-red-400" aria-hidden />}
                    {title}
                  </h3>
                  <ul className="space-y-4">
                    {items.map((it, i) => {
                      if (it.evidence) qi++
                      const id = `${prefix}${qi}`
                      return (
                        <li key={i}>
                          <p className="text-sm text-slate-200">{it.point}</p>
                          {it.evidence && (
                            <button
                              onClick={() => setActiveMark(id)}
                              className={`mt-1.5 text-left text-xs text-slate-400 italic hover:text-slate-200 ${kind === 'good' ? 'quote-good' : 'quote-mark'}`}
                              title="Show this in your resume below"
                            >
                              “{it.evidence}”
                            </button>
                          )}
                        </li>
                      )
                    })}
                    {items.length === 0 && <li className="text-sm text-slate-500">Nothing to show.</li>}
                  </ul>
                </Card>
              )
            })}
          </div>

          {/* Recommendations */}
          {!!analysis.recommendations?.length && (
            <Card padding="lg">
              <h3 className="font-semibold text-slate-100 mb-4">Fix these first</h3>
              <ol className="space-y-3">
                {analysis.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-indigo-500/10 text-indigo-400 font-mono text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                    <span className="pt-0.5">{r}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {resume && <RewritePanel key={resume.id} resumeId={resume.id} initial={resume.rewrites} />}

          {/* Resume with highlights */}
          {resume?.raw_text && (
            <Card padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold text-slate-100">Your resume, with the evidence marked</h3>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40 border-b-2 border-emerald-500" /> strength</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blossom border-b-2 border-red-500" /> to improve</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">Text as we read it from your file. Select a quote above to jump to it.</p>
              <ResumeViewer text={resume.raw_text} marks={marks} activeId={activeMark} />
            </Card>
          )}

          {/* Measured checks + skills */}
          <div className="grid lg:grid-cols-2 gap-6">
            {!!analysis.score_breakdown?.findings?.length && (
              <Card padding="lg">
                <h3 className="font-semibold text-slate-100 mb-4">Measured checks</h3>
                <ul className="space-y-2 text-sm text-slate-300 list-disc pl-5 marker:text-slate-500">
                  {analysis.score_breakdown.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </Card>
            )}
            {!!analysis.skills?.length && (
              <Card padding="lg">
                <h3 className="font-semibold text-slate-100 mb-4">Skills we found</h3>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.skills.map(s => <Badge key={s} variant="indigo">{s}</Badge>)}
                </div>
              </Card>
            )}
          </div>
        </motion.div>
      )}
    </PageTransition>
  )
}
