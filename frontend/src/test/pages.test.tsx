import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const analysis = {
  id: 'a1', resume_id: 'r1', ats_score: 78.4, summary: 'Final-year student with strong projects.', created_at: '2026-11-07T10:00:00',
  skills: ['Python', 'FastAPI'], keywords: ['FastAPI'], education: [], experience: [],
  strengths: ['Quantified internship results'], weaknesses: ['No live links'], recommendations: ['Add live demo links.', 'Quantify usage.'],
  score_breakdown: {
    career_level: 'student', findings: ['9 of 11 bullet points include a number or measurable result.'],
    categories: {
      structure: { score: 90, deterministic: 90, ai: null, ai_reason: null, weight: 0.2 },
      completeness: { score: 85, deterministic: 85, ai: null, ai_reason: null, weight: 0.15 },
      impact: { score: 70, deterministic: 60, ai: 80, ai_reason: 'Most bullets show results.', weight: 0.3 },
      keywords: { score: 72, deterministic: 70, ai: 74, ai_reason: 'Skills are backed by projects.', weight: 0.2 },
      readability: { score: 80, deterministic: 80, ai: 80, ai_reason: 'Concise.', weight: 0.15 },
    },
  },
  evidence: {
    strengths: [{ point: 'Quantified internship results', evidence: 'cutting average response time by 35%', verified: true }],
    weaknesses: [{ point: 'No live links', evidence: null, verified: null }],
  },
}
const earlier = { ...analysis, id: 'a0', ats_score: 62, created_at: '2026-10-01T10:00:00' }
const resumeDetail = {
  id: 'r1', filename: 'priya.pdf', word_count: 400, page_count: 1, file_type: 'pdf', created_at: '2026-11-07T10:00:00', rewrites: null,
  raw_text: 'Priya Sharma\n• Built 6 REST API endpoints, cutting average response time by 35%.\n• Worked on the admin panel.',
}
const scan = { name: 'Priya Sharma', latest_role: null, education: null, top_skills: ['Python'], signals: { email: true, phone: true, linkedin: false, github: true }, notes: [{ kind: 'warn', text: 'No LinkedIn link. Recruiters usually check it before replying.' }] }
const stats = { ats_score: 78, match_score: null, portfolio_score: null, overall_score: 78, overall_basis: ['Resume ATS score'], resume_count: 1, analysis_count: 2, match_count: 0, recruiter_report_count: 0 }

const routes: Record<string, unknown> = {
  '/resumes/': [{ id: 'r1', filename: 'priya.pdf', created_at: '2026-11-07T10:00:00' }],
  '/resumes/analyses': [analysis, earlier],
  '/resumes/r1': resumeDetail,
  '/resumes/r1/scan': scan,
  '/dashboard/stats': stats,
  '/dashboard/activity': [],
  '/dashboard/analytics': { ats_trend: [{ date: '2026-10-01T10:00:00', score: 62 }, { date: '2026-11-07T10:00:00', score: 78 }], match_trend: [], portfolio_trend: [] },
  '/job-match/': [], '/recruiter/': [], '/interview/': [], '/portfolio/': [],
}
const health = vi.fn(async (): Promise<unknown> => ({ status: 'ok', demo_mode: true, ai: { provider: 'gemini', model: 'x', configured: true } }))
const get = vi.fn(async (url: string) => ({ data: routes[url] ?? [] }))
const post = vi.fn()
vi.mock('../lib/api', async (orig) => ({
  ...(await orig<typeof import('../lib/api')>()),
  api: { get: (u: string) => get(u), post: (...a: unknown[]) => post(...a), patch: vi.fn(), delete: vi.fn() },
  fetchHealth: () => health(),
}))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }), Toaster: () => null }))

const as = (role: string) => useAuthStore.setState({ user: { id: 'u1', email: 'p@example.com', full_name: 'Priya Sharma', role }, token: 't' })
const renderPage = async (loader: () => Promise<{ default: React.ComponentType }>) => {
  const Page = (await loader()).default
  return render(<MemoryRouter><Page /></MemoryRouter>)
}

beforeEach(() => {
  get.mockClear(); post.mockReset(); as('candidate')
  health.mockImplementation(async () => ({ status: 'ok', demo_mode: true, ai: { provider: 'gemini', model: 'x', configured: true } }))
})

describe('every page renders without crashing', () => {
  const pages: [string, () => Promise<{ default: React.ComponentType }>][] = [
    ['Landing', () => import('../pages/Landing')],
    ['Dashboard', () => import('../pages/Dashboard')],
    ['ResumeLab', () => import('../pages/ResumeLab')],
    ['JobMatch', () => import('../pages/JobMatch')],
    ['Recruiter', () => import('../pages/Recruiter')],
    ['InterviewPrep', () => import('../pages/InterviewPrep')],
    ['Portfolio', () => import('../pages/Portfolio')],
    ['Analytics', () => import('../pages/Analytics')],
    ['Settings', () => import('../pages/Settings')],
    ['Screening', () => import('../pages/Screening')],
  ]
  it.each(pages)('%s', async (_n, loader) => {
    const { container } = await renderPage(loader)
    await waitFor(() => expect(container.textContent!.length).toBeGreaterThan(40))
  })

  it('static and auth pages', async () => {
    const m = await import('../pages/StaticPages')
    const a = await import('../pages/Auth')
    for (const C of [m.FeaturesPage, m.PricingPage, m.PrivacyPage, a.Login, a.Register]) {
      const { container, unmount } = render(<MemoryRouter><C /></MemoryRouter>)
      await waitFor(() => expect(container.textContent!.length).toBeGreaterThan(40))
      unmount()
    }
  })
})

describe('honesty of public pages', () => {
  it('the pricing page has no invented plans', async () => {
    const { PricingPage } = await import('../pages/StaticPages')
    render(<MemoryRouter><PricingPage /></MemoryRouter>)
    expect(screen.getByText(/no paid plans/i)).toBeInTheDocument()
    expect(screen.queryByText(/\$12|\$49|Teams|Enterprise/)).toBeNull()
  })
  it('the privacy page says the resume text goes to the AI provider', async () => {
    const { PrivacyPage } = await import('../pages/StaticPages')
    render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
    expect(screen.getByText(/sent to the AI provider/i)).toBeInTheDocument()
  })
  it('the landing page no longer claims data is never shared with third parties', async () => {
    const { container } = await renderPage(() => import('../pages/Landing'))
    expect(container.textContent).not.toMatch(/never shared with third parties/i)
  })
  it('the landing example matches the app\'s own verdict for that score', async () => {
    const { container } = await renderPage(() => import('../pages/Landing'))
    expect(container.textContent).toMatch(/68\s*\/ 100/)
    expect(container.textContent).toMatch(/Solid foundation/)
  })
  it('demo accounts show only when the server says they exist', async () => {
    const { Login } = await import('../pages/Auth')
    render(<MemoryRouter><Login /></MemoryRouter>)
    expect(await screen.findByText(/Demo accounts are shared/)).toBeInTheDocument()
  })
  it.each([['demo mode is off', { status: 'ok', demo_mode: false }], ['the server is unreachable', null]])('demo accounts are hidden when %s', async (_n, h) => {
    health.mockImplementation(async () => h)
    const { Login } = await import('../pages/Auth')
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => expect(health).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByText(/Demo accounts are shared/)).toBeNull()
    expect(screen.queryByRole('button', { name: /recruiter/i })).toBeNull()
  })
})

describe('Resume Lab, end to end through a real file upload', () => {
  it('uploads, analyzes, and shows score, progress, breakdown, evidence and scan', async () => {
    post.mockImplementation(async (url: string) =>
      url === '/resumes/upload' ? { data: { id: 'r1' } } : { data: analysis })
    const { container } = await renderPage(() => import('../pages/ResumeLab'))
    await screen.findByText('Your analyses')                                   // history from the API

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['%PDF-1.4 fake'], 'priya.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText('Strong')).toBeInTheDocument()             // 78.4 is 75 or more
    expect(post).toHaveBeenCalledWith('/resumes/upload', expect.any(FormData), expect.anything())
    expect(post).toHaveBeenCalledWith('/resumes/r1/analyze')
    expect(screen.getByText(/\+16.4 since/)).toBeInTheDocument()               // 78.4 vs the earlier 62
    expect(screen.getByText('Where your score comes from')).toBeInTheDocument()
    expect(screen.getByText('Most bullets show results.')).toBeInTheDocument()
    expect(screen.getByText('What a recruiter sees in 6 seconds')).toBeInTheDocument()
    expect(screen.getByText(/No LinkedIn link/)).toBeInTheDocument()
    expect(screen.getByText('Fix these first')).toBeInTheDocument()

    const viewer = screen.getByText(/Your resume, with the evidence marked/).closest('div')!.parentElement!
    const mark = viewer.querySelector('mark')
    expect(mark).toHaveTextContent('cutting average response time by 35%')     // the verified quote is highlighted in the text
    expect(screen.getByRole('button', { name: /rewrite bullets/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pdf report/i })).toBeInTheDocument()
  })

  it('shows the server\'s real reason when a file is rejected', async () => {
    post.mockRejectedValue({ response: { data: { detail: 'This doesn\'t look like a resume. It looks like an invoice.', code: 'NOT_A_RESUME' } } })
    const { container } = await renderPage(() => import('../pages/ResumeLab'))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['x'], 'bill.pdf', { type: 'application/pdf' }))
    expect(await screen.findByText(/It looks like an invoice/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('opens a past analysis from history', async () => {
    await renderPage(() => import('../pages/ResumeLab'))
    await userEvent.click((await screen.findAllByRole('button', { name: /priya\.pdf/ }))[0])
    expect(await screen.findByText('Strong')).toBeInTheDocument()
  })
})

describe('role gating and honesty on other pages', () => {
  it('Screening is locked for candidates', async () => {
    await renderPage(() => import('../pages/Screening'))
    expect(screen.getByText('For recruiter accounts')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rank candidates/i })).toBeNull()
  })
  it('Screening works for recruiters and needs all inputs before ranking', async () => {
    as('recruiter')
    await renderPage(() => import('../pages/Screening'))
    expect(screen.getByRole('button', { name: /rank candidates/i })).toBeDisabled()
  })
  it('Dashboard shows real history and explains the overall score', async () => {
    await renderPage(() => import('../pages/Dashboard'))
    expect(await screen.findByText('Score history')).toBeInTheDocument()
    expect(screen.getByText(/plain average of your latest resume ats score/i)).toBeInTheDocument()
    expect(screen.getByText(/risen 16 points since your first analysis/)).toBeInTheDocument()
    expect(screen.queryByText(/trending upward/i)).toBeNull()                  // the old hard-coded claim
  })
  it('Dashboard asks for a second analysis instead of drawing a made-up trend', async () => {
    routes['/dashboard/analytics'] = { ats_trend: [{ date: '2026-11-07T10:00:00', score: 78 }], match_trend: [], portfolio_trend: [] }
    await renderPage(() => import('../pages/Dashboard'))
    expect(await screen.findByText(/appear here after your second analysis/)).toBeInTheDocument()
  })
  it('Recruiter view has no fake chat', async () => {
    const { container } = await renderPage(() => import('../pages/Recruiter'))
    await waitFor(() => expect(container.textContent).toMatch(/Resume to review/))
    expect(container.textContent).not.toMatch(/Please review my resume/)
  })
  it('Settings no longer pretends to save notification toggles', async () => {
    const { container } = await renderPage(() => import('../pages/Settings'))
    expect(container.textContent).not.toMatch(/notification|digest|coming soon/i)
    expect(within(container).getByRole('button', { name: /download my data/i })).toBeInTheDocument()
  })
})

describe('FAQ markup', () => {
  it('every question is a direct <summary> child of its <details>, so browsers show the question', async () => {
    const { container } = await renderPage(() => import('../pages/Landing'))
    const details = [...container.querySelectorAll('details')]
    expect(details.length).toBeGreaterThanOrEqual(4)
    for (const d of details) {
      const summary = d.querySelector(':scope > summary')
      expect(summary).not.toBeNull()
      expect(summary!.textContent!.trim().length).toBeGreaterThan(8)
    }
  })
})
