import { useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../lib/api'
import {
  Button, Card, PageHeader, Badge, ProgressBar, ScoreRing, Input,
} from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import { Github, RotateCcw, TrendingUp, Code, Star } from 'lucide-react'
import toast from 'react-hot-toast'

interface Portfolio {
  github_username: string
  repo_count: number
  languages: Record<string, number>
  portfolio_score: number
  internship_readiness: string
  suggestions: string[]
}

const LANG_COLORS = ['#B8284F', '#5E8A3A', '#A86A0C', '#C2294A', '#4F72A3', '#8F2349', '#8FA859']

export default function Portfolio() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Portfolio | null>(null)

  const analyze = async () => {
    if (!username.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/portfolio/', { github_username: username.trim() })
      setResult(data)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to analyze portfolio')
    } finally {
      setLoading(false)
    }
  }

  const readinessColor = (r: string) => (r === 'High' ? 'green' : r === 'Medium' ? 'yellow' : 'red') as 'green' | 'yellow' | 'red'
  const maxLang = result ? Math.max(...Object.values(result.languages), 1) : 1

  const chartData = result
    ? Object.entries(result.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, value]) => ({ name, value }))
    : []

  return (
    <PageTransition>
      <PageHeader
        title="Portfolio Analyzer"
        subtitle="Connect your GitHub to score project quality and internship readiness."
        action={
          result ? (
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => setResult(null)}>
              Analyze another
            </Button>
          ) : undefined
        }
      />

      {!result ? (
        <div className="max-w-lg">
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-surface-3 border border-ink/10 flex items-center justify-center">
                <Github size={24} className="text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">GitHub username</h3>
                <p className="text-sm text-slate-500">Public repositories only</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyze()}
                placeholder="e.g. torvalds"
                className="flex-1"
                floating={false}
              />
              <Button onClick={analyze} loading={loading} disabled={!username.trim()}>
                Analyze
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Profile card */}
          <Card padding="lg" className="gradient-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-surface-3 border border-ink/10 flex items-center justify-center">
                  <Github size={28} className="text-slate-300" />
                </div>
                <div>
                  <p className="font-bold text-xl">@{result.github_username}</p>
                  <p className="text-sm text-slate-500">{result.repo_count} public repositories</p>
                  <div className="flex gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < Math.round(result.portfolio_score / 20) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <ScoreRing score={result.portfolio_score} label="Portfolio Score" size={100} />
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-2">Internship readiness</p>
                  <Badge color={readinessColor(result.internship_readiness)} size="md">
                    {result.internship_readiness}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Language chart */}
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-4">
                <Code size={15} className="text-indigo-400" />
                <h4 className="font-semibold">Languages used</h4>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#FBFCF5', border: '1px solid #D3DBB8', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3 w-full">
                  {Object.entries(result.languages)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 7)
                    .map(([lang, count], i) => (
                      <div key={lang}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} />
                            {lang}
                          </span>
                          <span className="text-slate-500">{count} repos</span>
                        </div>
                        <ProgressBar value={count} max={maxLang} color={LANG_COLORS[i % LANG_COLORS.length]} />
                      </div>
                    ))}
                </div>
              </div>
            </Card>

            {/* Suggestions */}
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-emerald-400" />
                <h4 className="font-semibold">AI suggestions</h4>
              </div>
              <div className="space-y-3">
                {result.suggestions?.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-3 p-3 rounded-xl bg-surface-3/50 border border-ink/5"
                  >
                    <span className="font-mono text-[10px] text-indigo-400 font-bold shrink-0 mt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm text-slate-400 leading-relaxed">{s}</p>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>
        </motion.div>
      )}
    </PageTransition>
  )
}
