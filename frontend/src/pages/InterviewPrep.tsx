import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, errorMessage } from '../lib/api'
import {
  Button, Card, PageHeader, Badge, Input, Select, EmptyState,
} from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import {
  MessageSquare, RotateCcw, ChevronDown, ChevronUp, Clock,
  Target, Play, Pause,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Resume { id: string; filename: string }
interface Question { question: string; expected_answer: string; evaluation_criteria: string }
interface Session {
  id: string
  job_role: string
  technical_questions: Question[]
  behavioral_questions: Question[]
  project_questions: Question[]
}

const DIFFICULTY = ['Easy', 'Medium', 'Hard']

function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!active || !running) return
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [active, running])

  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return { seconds, running, setRunning, fmt, reset: () => setSeconds(0) }
}

export default function InterviewPrep() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeId, setResumeId] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const timer = useTimer(!!session)

  useEffect(() => {
    api.get('/resumes/').then(r => {
      setResumes(r.data)
      if (r.data[0]) setResumeId(r.data[0].id)
    })
  }, [])

  const generate = async () => {
    if (!jobRole.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/interview/', { resume_id: resumeId || null, job_role: jobRole })
      setSession(data)
      timer.reset()
      timer.setRunning(true)
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to generate questions'))
    } finally {
      setLoading(false)
    }
  }

  const totalQuestions = session
    ? (session.technical_questions?.length || 0) +
      (session.behavioral_questions?.length || 0) +
      (session.project_questions?.length || 0)
    : 0

  const progress = totalQuestions > 0 ? (answered.size / totalQuestions) * 100 : 0

  const QuestionCard = ({ q, id, index, badge }: { q: Question; id: string; index: number; badge: 'blue' | 'purple' | 'green' }) => {
    const open = expanded === id
    const diff = DIFFICULTY[index % 3]

    return (
      <Card padding="none" className="overflow-hidden">
        <Button
          variant="ghost"
          onClick={() => setExpanded(open ? null : id)}
          className="w-full h-auto min-h-[56px] px-5 py-4 justify-between rounded-none hover:bg-indigo-500/5"
        >
          <div className="flex items-start gap-3 text-left flex-1">
            <span className="font-mono text-xs text-indigo-400 font-bold shrink-0 mt-1">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-200 leading-relaxed">{q.question}</p>
              <div className="flex gap-2 mt-2">
                <Badge color={badge} size="sm">{badge === 'blue' ? 'Technical' : badge === 'purple' ? 'Behavioral' : 'Project'}</Badge>
                <Badge color={diff === 'Hard' ? 'red' : diff === 'Medium' ? 'yellow' : 'green'} size="sm">{diff}</Badge>
              </div>
            </div>
          </div>
          {open ? <ChevronUp size={16} className="text-slate-500 shrink-0" /> : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
        </Button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-ink/5"
            >
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Expected answer</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{q.expected_answer}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Evaluation criteria</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{q.evaluation_criteria}</p>
                </div>
                <Button
                  variant={answered.has(id) ? 'success' : 'outline'}
                  size="sm"
                  onClick={() => setAnswered(prev => new Set([...prev, id]))}
                >
                  {answered.has(id) ? 'Reviewed ✓' : 'Mark as reviewed'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    )
  }

  const Section = ({
    title,
    questions,
    badge,
    offset,
  }: {
    title: string
    questions: Question[]
    badge: 'blue' | 'purple' | 'green'
    offset: number
  }) => (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold">{title}</h3>
        <Badge color={badge}>{questions.length} questions</Badge>
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <QuestionCard key={i} q={q} id={`${title}-${i}`} index={offset + i} badge={badge} />
        ))}
      </div>
    </Card>
  )

  return (
    <PageTransition>
      <PageHeader
        title="Interview Prep"
        subtitle="AI-generated questions tailored to your role and resume."
        action={
          session ? (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => { setSession(null); setAnswered(new Set()) }}>
              New session
            </Button>
          ) : undefined
        }
      />

      {!session ? (
        <div className="max-w-xl">
          <Card padding="lg" className="space-y-5">
            <Input
              label="Target role"
              value={jobRole}
              onChange={e => setJobRole(e.target.value)}
              placeholder="e.g. Software Engineering Intern"
            />
            {resumes.length > 0 && (
              <Select
                label="Resume context (optional)"
                value={resumeId}
                onChange={setResumeId}
                options={[
                  { value: '', label: 'No resume — generic questions' },
                  ...resumes.map(r => ({ value: r.id, label: r.filename })),
                ]}
              />
            )}
            <Button
              onClick={generate}
              loading={loading}
              icon={<MessageSquare size={16} />}
              disabled={!jobRole.trim()}
              fullWidth
            >
              Generate questions
            </Button>
          </Card>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Session header */}
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                  <MessageSquare size={18} className="text-indigo-400" />
                </div>
                <div>
                  <p className="font-bold">{session.job_role}</p>
                  <p className="text-xs text-slate-500">{totalQuestions} questions generated</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-3 border border-ink/5">
                  <Clock size={14} className="text-slate-500" />
                  <span className="font-mono text-sm font-bold">{timer.fmt}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => timer.setRunning(r => !r)}
                  >
                    {timer.running ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-emerald-400" />
                  <span className="text-sm text-slate-400">{answered.size}/{totalQuestions} reviewed</span>
                </div>
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                animate={{ width: `${progress}%` }}
              />
            </div>
          </Card>

          <Section title="Technical questions" questions={session.technical_questions || []} badge="blue" offset={0} />
          <Section title="Behavioral questions" questions={session.behavioral_questions || []} badge="purple" offset={session.technical_questions?.length || 0} />
          <Section title="Project questions" questions={session.project_questions || []} badge="green" offset={(session.technical_questions?.length || 0) + (session.behavioral_questions?.length || 0)} />
        </div>
      )}
    </PageTransition>
  )
}
