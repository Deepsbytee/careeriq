import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { MarketingLayout } from '../components/marketing/MarketingLayout'
import { Button, Card, Badge } from '../components/ui'

const FEATURES = [
  {
    title: 'Resume Lab',
    desc: 'Upload a resume and get a score you can understand. Structure and completeness are measured by rules; impact, keywords and readability blend those measurements with an AI review.',
    bullets: ['Five-category score breakdown', 'Quotes from your resume as evidence, each one verified', 'Stronger rewrites of your weakest bullets', 'Downloadable PDF report'],
  },
  {
    title: 'Six-second scan',
    desc: 'A recruiter skims before they read. See what your resume gives away at a glance, and what is easy to miss.',
    bullets: ['Name, latest role, education, top skills', 'Contact and link checks', 'Measured, not guessed'],
  },
  {
    title: 'Job Match',
    desc: 'Paste a job description and see each requirement checked against your resume, with the proof.',
    bullets: ['Met, partly met, or missing, per requirement', 'Must-haves count double', 'Never says you lack a skill that is on your resume'],
  },
  {
    title: 'Recruiter view and interview prep',
    desc: 'An AI reads your resume the way a screener might, and generates questions based on what you actually wrote.',
    bullets: ['Estimated shortlist chance and verdict', 'Risks a hiring manager might see', 'Questions tied to your own projects'],
  },
  {
    title: 'Portfolio analyzer',
    desc: 'Scores a public GitHub profile from real repository data: original projects, descriptions, recent activity, and languages.',
    bullets: ['Forks are ignored', 'Uses only what GitHub reports', 'Clear errors if GitHub is unreachable'],
  },
  {
    title: 'Screening for recruiters',
    desc: 'Rank a stack of resumes against a job description. Rule-based, so the same input always gives the same ranking, and each placement is explained.',
    bullets: ['Up to 15 resumes at once', 'Required skills matched and missing', 'Nothing is stored'],
  },
]

export function FeaturesPage() {
  return (
    <MarketingLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <Badge variant="indigo" className="mb-4">What it does</Badge>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Feedback you can check.</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Every score is explained, and every quote the AI gives is verified against your resume before you see it.
          </p>
        </motion.div>

        <div className="space-y-6">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
              <Card className="flex flex-col lg:flex-row gap-8" padding="lg">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-2xl mb-3">{f.title}</h2>
                  <p className="text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
                <ul className="lg:w-72 shrink-0 space-y-2.5">
                  {f.bullets.map(b => (
                    <li key={b} className="flex gap-2.5 text-sm text-slate-300">
                      <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />{b}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link to="/register"><Button size="lg" iconRight={<ArrowRight size={16} />}>Try it free</Button></Link>
        </div>
      </div>
    </MarketingLayout>
  )
}

export function PricingPage() {
  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12">
          <Badge variant="indigo" className="mb-4">Pricing</Badge>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Free to use.</h1>
          <p className="text-slate-400 text-lg">CareerIQ is a free project. There are no paid plans and no payment is taken.</p>
        </div>
        <Card padding="lg">
          <h2 className="font-semibold text-lg mb-4">Fair use</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Each AI analysis costs real compute, so there is a daily limit per account and a short limit per minute.
            Repeating an analysis of the same resume is instant and doesn't count, because the saved result is reused.
          </p>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li className="flex gap-2.5"><Check size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />All features are included</li>
            <li className="flex gap-2.5"><Check size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />Download or delete your data at any time</li>
            <li className="flex gap-2.5"><Check size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />No ads in the app</li>
          </ul>
        </Card>
        <div className="text-center mt-10">
          <Link to="/register"><Button size="lg" iconRight={<ArrowRight size={16} />}>Create an account</Button></Link>
        </div>
      </div>
    </MarketingLayout>
  )
}

const PRIVACY = [
  ['What we store', 'Your account (name, email, and a hashed password), the text of resumes you upload, and the results of your analyses. The original file is not kept, only the text extracted from it. Everything is private to your account.'],
  ['What leaves our servers', 'To review your resume, its text is sent to the AI provider that runs this site (Google Gemini by default). What is sent is the text of your resume or job description, which includes whatever it contains, such as your name and contact details. Your account email and password are not sent. Check that provider\'s data terms before uploading real personal details, especially if the site runs on a free AI tier, where some providers may use submitted content to improve their products.'],
  ['Your passwords', 'Stored only as bcrypt hashes. We can\'t read them.'],
  ['Your control', 'In Settings you can download everything we store about you, change your password, or delete your account. Deleting removes your resumes and every analysis immediately.'],
  ['Recruiter screening', 'Resumes uploaded for screening are read in memory to produce a ranking and are not saved.'],
]

export function PrivacyPage() {
  return (
    <MarketingLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight mb-3">How your data is handled</h1>
        <p className="text-slate-400 mb-10">A plain description of what this site does with your resume.</p>
        <div className="space-y-5">
          {PRIVACY.map(([h, p]) => (
            <Card key={h} padding="lg">
              <h2 className="font-semibold text-lg mb-2">{h}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{p}</p>
            </Card>
          ))}
        </div>
      </div>
    </MarketingLayout>
  )
}
