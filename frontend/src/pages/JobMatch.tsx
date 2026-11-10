import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api, errorMessage } from '../lib/api'
import type { Requirement } from '../lib/types'
import {
  Button, Card, PageHeader, Badge, Textarea, ScoreRing, Input,
  Radio, Spinner, StepIndicator, SearchBox, Select, EmptyState,
} from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import { Briefcase, AlertCircle, RotateCcw, Check, X, Minus, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Resume { id: string; filename: string; created_at: string }
interface Match {
  id: string
  job_title: string
  match_score: number
  skill_match_score: number
  keyword_match_score: number
  missing_skills: string[]
  missing_keywords: string[]
  missing_technologies: string[]
  recommendations: string[]
  requirements?: Requirement[] | null
}

const STATUS: Record<Requirement['status'], { label: string; color: 'green' | 'yellow' | 'red' | 'default'; icon: typeof Check }> = {
  met: { label: 'Met', color: 'green', icon: Check },
  partial: { label: 'Partly', color: 'yellow', icon: Minus },
  missing: { label: 'Missing', color: 'red', icon: X },
  unverified: { label: "Couldn't verify", color: 'default', icon: HelpCircle },
}

function RequirementsTable({ items }: { items: Requirement[] }) {
  return (
    <Card padding="lg">
      <h4 className="font-semibold mb-1">Requirement by requirement</h4>
      <p className="text-xs text-slate-500 mb-5 max-w-2xl">
        Each requirement from the posting, checked against your resume. “Met” and “Partly” need a quote from your resume as proof.
        If the proof can't be found in your text, it's shown as “Couldn't verify” and counts for less.
      </p>
      <ul className="divide-y divide-border">
        {items.map((r, i) => {
          const st = STATUS[r.status]
          const Icon = st.icon
          return (
            <li key={i} className="py-4 first:pt-0 last:pb-0 grid sm:grid-cols-[1fr_auto] gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">
                  {r.requirement}
                  {r.importance === 'nice' && <span className="ml-2 text-xs font-normal text-slate-500">nice to have</span>}
                </p>
                {r.evidence && <p className="mt-1.5 text-xs text-slate-400 italic quote-good inline-block">“{r.evidence}”</p>}
                {r.note && <p className="mt-1.5 text-xs text-slate-400">{r.note}</p>}
              </div>
              <div className="sm:text-right">
                <Badge color={st.color} size="md"><Icon size={13} className="mr-1" aria-hidden />{st.label}</Badge>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

type Step = 'select' | 'describe' | 'processing' | 'result'

export default function JobMatch() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResume, setSelectedResume] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [result, setResult] = useState<Match | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => {
    api.get('/resumes/').then(r => {
      setResumes(r.data)
      if (r.data.length > 0) setSelectedResume(r.data[0].id)
    })
  }, [])

  const filteredResumes = useMemo(() => {
    let list = [...resumes]
    if (search) list = list.filter(r => r.filename.toLowerCase().includes(search.toLowerCase()))
    if (sortBy === 'date') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else list.sort((a, b) => a.filename.localeCompare(b.filename))
    return list
  }, [resumes, search, sortBy])

  const run = async () => {
    if (!selectedResume || !jobDesc.trim()) return
    setStep('processing')
    try {
      const { data } = await api.post('/job-match/', {
        resume_id: selectedResume,
        job_title: jobTitle,
        job_description: jobDesc,
      })
      setResult(data)
      setStep('result')
    } catch (err) {
      toast.error(errorMessage(err, 'Match failed'))
      setStep('describe')
    }
  }

  const reset = () => {
    setStep('select')
    setResult(null)
    setJobTitle('')
    setJobDesc('')
  }

  const stepIndex = { select: 0, describe: 1, processing: 2, result: 3 }[step]

  return (
    <PageTransition>
      <PageHeader
        title="Job Match"
        subtitle="Paste a job description and get a precise skills gap analysis."
        action={
          step === 'result' ? (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={reset}>
              New match
            </Button>
          ) : undefined
        }
      />

      {step !== 'result' && (
        <StepIndicator
          steps={['Select resume', 'Job description', 'Processing', 'Results']}
          current={stepIndex}
        />
      )}

      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl">
            <Card padding="lg">
              <h3 className="font-bold text-lg mb-4">Select a resume</h3>

              {resumes.length === 0 ? (
                <EmptyState
                  icon={<Briefcase size={28} />}
                  title="No resumes found"
                  description="Upload a resume first to run job matching."
                  action={
                    <Link to="/resume-lab">
                      <Button size="sm">Go to Resume Lab</Button>
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="flex gap-3 mb-4">
                    <SearchBox value={search} onChange={setSearch} placeholder="Search resumes..." className="flex-1" />
                    <Select
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { value: 'date', label: 'Newest first' },
                        { value: 'name', label: 'Name A–Z' },
                      ]}
                      className="w-40"
                    />
                  </div>

                  <div className="space-y-2 mb-6">
                    {filteredResumes.map(r => (
                      <Radio
                        key={r.id}
                        checked={selectedResume === r.id}
                        onChange={() => setSelectedResume(r.id)}
                        label={r.filename}
                        description={new Date(r.created_at).toLocaleDateString()}
                        icon={<Briefcase size={16} />}
                      />
                    ))}
                  </div>

                  <Button onClick={() => setStep('describe')} disabled={!selectedResume} fullWidth>
                    Continue
                  </Button>
                </>
              )}
            </Card>
          </motion.div>
        )}

        {step === 'describe' && (
          <motion.div key="describe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
            <Card padding="lg" className="space-y-5">
              <h3 className="font-bold text-lg">Job description</h3>
              <Input
                label="Job title"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Software Engineering Intern"
              />
              <Textarea
                label="Paste the full job description"
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                placeholder="Copy and paste the job description here..."
                rows={10}
              />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep('select')}>Back</Button>
                <Button onClick={run} disabled={!jobDesc.trim()}>Generate match analysis</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div key="processing" className="text-center py-20">
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
              <Spinner size={32} />
            </div>
            <p className="font-bold text-lg mb-2">Matching your resume...</p>
            <p className="text-slate-400 text-sm">Comparing skills, keywords, and technologies</p>
          </motion.div>
        )}

        {step === 'result' && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <Card padding="lg" className="gradient-border">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex gap-6 shrink-0">
                  <ScoreRing score={result.match_score} label="Overall match" size={112} />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-serif font-semibold text-2xl mb-2">{result.job_title || 'Match results'}</h3>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3">
                    <Badge color="blue">Skills {Math.round(result.skill_match_score)}%</Badge>
                    <Badge color="indigo">Keywords {Math.round(result.keyword_match_score)}%</Badge>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    {result.requirements?.length
                      ? 'The overall match is half the AI\'s judgement of fit and half how well you cover the posting\'s requirements (must-haves count double).'
                      : 'The overall match is the AI\'s judgement of fit.'}
                  </p>
                </div>
              </div>
            </Card>

            {!!result.requirements?.length && <RequirementsTable items={result.requirements} />}

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Missing skills', items: result.missing_skills, color: 'red' as const },
                { label: 'Missing keywords', items: result.missing_keywords, color: 'yellow' as const },
                { label: 'Missing technologies', items: result.missing_technologies, color: 'blue' as const },
              ].map(({ label, items, color }) => (
                <Card key={label} padding="md">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={14} className={`text-${color === 'red' ? 'red' : color === 'yellow' ? 'amber' : 'blue'}-400`} />
                    <h4 className="font-semibold text-sm">{label}</h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {items?.length ? items.map(i => <Badge key={i} color={color}>{i}</Badge>) : (
                      <span className="text-xs text-slate-500">None identified</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Card padding="md">
              <h4 className="font-semibold mb-4">Recommendations to improve your match</h4>
              <div className="space-y-2">
                {result.recommendations?.map((r, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl bg-surface-3/50 border border-ink/5 text-sm text-slate-300">
                    <span className="font-mono text-xs text-indigo-400 font-bold shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {r}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
