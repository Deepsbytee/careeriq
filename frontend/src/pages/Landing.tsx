import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, FileSearch, Gauge, PenLine, ShieldCheck, Quote, Repeat, Trash2 } from 'lucide-react'
import { MarketingLayout } from '../components/marketing/MarketingLayout'
import { Badge, Button, Card } from '../components/ui'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
}

const STEPS = [
  { icon: FileSearch, title: 'Upload your resume', desc: 'PDF, DOCX or TXT. Anything that is not a readable resume is rejected up front, so you never get a score for the wrong document.' },
  { icon: Gauge, title: 'See where the score comes from', desc: 'Five categories, each explained. Part of the score is measured by rules and never changes; part is an AI review.' },
  { icon: PenLine, title: 'Fix the weakest lines', desc: 'Get stronger versions of your weakest bullets. Where a number would help, you get a [placeholder] to fill in with the truth.' },
]

const TRUST = [
  { icon: Quote, title: 'Every quote is verified', desc: 'When the AI points at a line in your resume, we check that line really exists in your text. Made-up quotes are thrown away before you see them.' },
  { icon: Repeat, title: 'Repeatable numbers', desc: 'Structure, completeness and the measurable parts of impact are computed by rules. The same resume gets the same numbers every time.' },
  { icon: ShieldCheck, title: 'No invented achievements', desc: 'Rewrites never add figures that are not in your resume. A rewrite that does is discarded.' },
  { icon: Trash2, title: 'Your data, your call', desc: 'Download everything we store, or delete your account and all of it in one step.' },
]

const FAQ = [
  { q: 'Is CareerIQ free?', a: 'Yes. There are no paid plans. Each account has a fair-use limit on AI analyses per day, and repeating an analysis of the same resume is instant and free.' },
  { q: 'Does an AI read my resume?', a: 'Yes. Rules we run ourselves measure part of your score; an AI model reviews the rest. The resume text is sent to the AI provider to do that. See how your data is handled for the details.' },
  { q: 'What counts as a resume?', a: 'A document with your contact details and your experience or projects, education, and skills. Invoices, papers, scans and photos are rejected with a clear reason.' },
  { q: 'What file formats work?', a: 'PDF, DOCX and TXT up to 5 MB. A PDF needs a text layer: if you can select the text, it works.' },
  { q: 'Can I trust the score?', a: 'Treat it as a well-explained checklist, not a verdict. Real applicant tracking systems and recruiters differ, which is why we show exactly what was measured and what was judged.' },
]

function ExampleCard() {
  const rows: [string, number, string][] = [
    ['Structure', 88, 'bg-emerald-500'],
    ['Keywords and skills', 72, 'bg-emerald-500'],
    ['Impact', 46, 'bg-red-500'],
  ]
  return (
    <Card padding="lg" className="text-left shadow-glow gradient-border">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Example result</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-6xl font-semibold text-indigo-500 leading-none">68</span>
            <span className="text-slate-400">/ 100</span>
          </div>
        </div>
        <Badge variant="green" size="md">Solid foundation</Badge>
      </div>

      <div className="space-y-3 mb-6">
        {rows.map(([label, score, color]) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">{label}</span>
              <span className="font-mono text-slate-100">{score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-surface-2 border border-border p-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">From the resume</p>
        <p className="text-sm text-slate-200 leading-relaxed">
          <span className="quote-mark">Built a REST API for task management</span> using FastAPI and PostgreSQL.
        </p>
        <p className="text-xs text-red-400 mt-2.5">No result stated. Try: cut response time by [X%] for [N] users.</p>
      </div>
    </Card>
  )
}

export default function Landing() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-20 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <motion.div {...fadeUp}>
            <Badge variant="indigo" size="md" className="mb-6">Honest resume feedback</Badge>
          </motion.div>
          <motion.h1 {...fadeUp} transition={{ delay: 0.08 }} className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08] mb-6">
            Find out exactly why your resume gets <span className="gradient-text">skipped.</span>
          </motion.h1>
          <motion.p {...fadeUp} transition={{ delay: 0.16 }} className="text-lg text-slate-400 max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed">
            Upload a resume and get a score you can understand: every number explained, every quote checked against your actual text.
          </motion.p>
          <motion.div {...fadeUp} transition={{ delay: 0.24 }} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link to="/register"><Button size="lg" iconRight={<ArrowRight size={16} />}>Analyze my resume</Button></Link>
            <Link to="/features"><Button variant="outline" size="lg">See what it does</Button></Link>
          </motion.div>
        </div>
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="max-w-md w-full mx-auto lg:mx-0">
          <ExampleCard />
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <motion.div {...fadeUp} className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">Three steps, nothing hidden.</h2>
          <p className="text-slate-400 text-lg">You see what was measured, what was judged, and what to change.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} {...fadeUp} transition={{ delay: i * 0.08 }}>
              <Card padding="lg" className="h-full">
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <s.icon size={19} className="text-indigo-400" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-slate-500">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why trust it */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <motion.div {...fadeUp} className="rounded-3xl bg-indigo-600 text-white p-8 sm:p-12 relative overflow-hidden">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3 text-blossom">Why you can rely on the feedback</h2>
            <p className="text-blossom/80 text-lg">Most resume tools just show a number. This one shows its working.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {TRUST.map(t => (
              <div key={t.title} className="flex gap-4">
                <span className="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
                  <t.icon size={19} className="text-emerald-200" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{t.title}</h3>
                  <p className="text-sm text-blossom/80 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
        </motion.div>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <motion.details
              key={item.q}
              {...fadeUp}
              transition={{ delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-surface-card shadow-card px-5 py-4"
            >
              {/* <summary> must be a direct child of <details>, or browsers show a default "Details" label */}
              <summary className="flex items-center justify-between gap-4 font-semibold text-sm list-none cursor-pointer">
                {item.q}
                <ChevronDown size={16} className="text-slate-500 shrink-0 group-open:rotate-180 transition-transform" aria-hidden />
              </summary>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">{item.a}</p>
            </motion.details>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/privacy" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4">How your data is handled</Link>
        </p>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <motion.div {...fadeUp} className="rounded-3xl bg-matcha-mist border border-border p-10 sm:p-14 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">See what a recruiter would notice.</h2>
          <p className="text-slate-400 mb-8 text-lg">Free to use. It takes about a minute.</p>
          <Link to="/register"><Button size="lg" iconRight={<ArrowRight size={16} />}>Analyze my resume</Button></Link>
        </motion.div>
      </section>
    </MarketingLayout>
  )
}
