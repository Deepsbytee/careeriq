import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, FileText, HelpCircle, ShieldAlert, UserCheck } from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { Badge, Button, Card, EmptyState, PageHeader, ScoreRing, Select, Spinner } from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'

interface Resume { id: string; filename: string }
interface Report {
  id: string
  shortlist_probability: number
  recruiter_notes: string
  strengths: string[]
  weaknesses: string[]
  risk_factors: string[]
  hiring_recommendation: string
  interview_questions: { question: string; type: string }[]
}

const REC_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'indigo'> = {
  'Strong Yes': 'green', Yes: 'green', Maybe: 'yellow', No: 'red',
}

function Section({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: string[]; tone: string }) {
  if (!items?.length) return null
  return (
    <Card padding="lg">
      <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">{icon}{title}</h3>
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-300">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Recruiter() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.get('/resumes/')
      .then(r => { setResumes(r.data); if (r.data[0]) setSelected(r.data[0].id) })
      .finally(() => setReady(true))
  }, [])

  const run = async () => {
    setLoading(true)
    setReport(null)
    try {
      const { data } = await api.post('/recruiter/', { resume_id: selected })
      setReport(data)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not generate the review'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="Recruiter view"
        subtitle="An AI reads your resume the way a screener might, and tells you what would help or hurt. It's an estimate, not a real hiring decision."
      />

      {!ready ? (
        <div className="flex justify-center py-24"><Spinner size={28} /></div>
      ) : resumes.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<FileText size={28} />}
            title="No resumes yet"
            description="Upload a resume in Resume Lab first, then come back for a recruiter's-eye review."
            action={<Link to="/resume-lab"><Button>Go to Resume Lab</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <Select
                  label="Resume to review"
                  value={selected}
                  onChange={setSelected}
                  options={resumes.map(r => ({ value: r.id, label: r.filename }))}
                />
              </div>
              <Button icon={<UserCheck size={16} />} loading={loading} onClick={run} disabled={!selected}>
                {report ? 'Review again' : 'Get recruiter review'}
              </Button>
            </div>
          </Card>

          {loading && (
            <div className="flex flex-col items-center py-16 text-center" role="status" aria-live="polite">
              <Spinner size={30} className="mb-4 text-indigo-400" />
              <p className="text-sm text-slate-400">Reading your resume. This takes 10 to 30 seconds.</p>
            </div>
          )}

          {report && !loading && (
            <div className="space-y-6">
              <Card padding="lg" className="gradient-border">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <ScoreRing score={Math.round(report.shortlist_probability)} label="Estimated shortlist chance" size={116} />
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                      <h2 className="text-2xl font-semibold">Verdict</h2>
                      <Badge color={REC_COLOR[report.hiring_recommendation] ?? 'indigo'} size="md">{report.hiring_recommendation}</Badge>
                    </div>
                    <p className="text-sm text-slate-300 max-w-2xl">{report.recruiter_notes}</p>
                  </div>
                </div>
              </Card>

              <div className="grid lg:grid-cols-2 gap-6">
                <Section title="Strengths" icon={<Check size={16} className="text-emerald-400" aria-hidden />} items={report.strengths} tone="bg-emerald-500" />
                <Section title="Weaknesses" icon={<AlertTriangle size={16} className="text-red-400" aria-hidden />} items={report.weaknesses} tone="bg-red-500" />
              </div>
              <Section title="What might worry a hiring manager" icon={<ShieldAlert size={16} className="text-amber-400" aria-hidden />} items={report.risk_factors} tone="bg-amber-500" />

              {!!report.interview_questions?.length && (
                <Card padding="lg">
                  <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <HelpCircle size={16} className="text-indigo-400" aria-hidden /> Questions you might be asked
                  </h3>
                  <ol className="space-y-4">
                    {report.interview_questions.map((q, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="h-6 w-6 shrink-0 rounded-full bg-indigo-500/10 text-indigo-400 font-mono text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                        <div>
                          <p className="text-sm text-slate-200">{q.question}</p>
                          <span className="text-xs text-slate-500 capitalize">{q.type}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </PageTransition>
  )
}
