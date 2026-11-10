import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { Card, PageHeader, EmptyState, Spinner } from '../components/ui'
import { PageTransition } from '../components/layout/PageTransition'
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { BarChart2, TrendingUp } from 'lucide-react'

interface Trend { date: string; score: number }
interface Analytics { ats_trend: Trend[]; match_trend: Trend[]; portfolio_trend: Trend[] }

const fmt = (d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })

function ChartCard({ data, color, label, gradientId }: { data: Trend[]; color: string; label: string; gradientId: string }) {
  return (
    <Card padding="lg" hover>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-slate-400">{label}</h3>
        <TrendingUp size={14} className="text-slate-600" />
      </div>
      {data.length < 2 ? (
        <div className="h-36 flex items-center justify-center text-slate-600 text-sm">
          Need more data points to show trend
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data.map(d => ({ ...d, date: fmt(d.date) }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,26,30,0.08)" />
            <XAxis dataKey="date" tick={{ fill: '#6F6563', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6F6563', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#FBFCF5', border: '1px solid #D3DBB8', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="score" stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={{ fill: color, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export default function Analytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/analytics').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner size={32} />
      </div>
    )
  }

  const hasAny = data && (data.ats_trend.length > 0 || data.match_trend.length > 0 || data.portfolio_trend.length > 0)

  return (
    <PageTransition>
      <PageHeader title="Analytics" subtitle="Track your career intelligence scores over time." />

      {!hasAny ? (
        <Card padding="lg">
          <EmptyState
            icon={<BarChart2 size={36} />}
            title="No data yet"
            description="Run analyses, job matches, and portfolio reviews to start seeing trends here."
          />
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-5"
        >
          <ChartCard data={data!.ats_trend} color="#B8284F" label="ATS Score trend" gradientId="atsGrad" />
          <ChartCard data={data!.match_trend} color="#5E8A3A" label="Job match score trend" gradientId="matchGrad" />
          <ChartCard data={data!.portfolio_trend} color="#A86A0C" label="Portfolio score trend" gradientId="portGrad" />
        </motion.div>
      )}
    </PageTransition>
  )
}
