import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CategoryBars } from '../components/resume/CategoryBars'
import { ScanCard } from '../components/resume/ScanCard'
import { ResumeViewer } from '../components/resume/ResumeViewer'
import { RewritePanel } from '../components/resume/RewritePanel'
import { ScoreRing } from '../components/ui'
import type { Scan } from '../lib/types'

const post = vi.fn()
vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), api: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

beforeEach(() => post.mockReset())

describe('CategoryBars', () => {
  const cats = {
    structure: { score: 90, deterministic: 90, ai: null, ai_reason: null, weight: 0.2 },
    impact: { score: 48, deterministic: 40, ai: 56, ai_reason: 'Few results have numbers.', weight: 0.3 },
  }
  it('shows each category, its weight, and whether it was measured or AI-rated', () => {
    render(<CategoryBars categories={cats} />)
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText('20% of score')).toBeInTheDocument()
    expect(screen.getByText(/measured by rules/)).toBeInTheDocument()
    expect(screen.getByText(/measured 40, AI review 56/)).toBeInTheDocument()
    expect(screen.getByText('Few results have numbers.')).toBeInTheDocument()
  })
  it('exposes scores to screen readers', () => {
    render(<CategoryBars categories={cats} />)
    expect(screen.getByRole('img', { name: 'Impact: 48 out of 100' })).toBeInTheDocument()
  })
})

describe('ScanCard', () => {
  const scan: Scan = {
    name: 'Priya Sharma', latest_role: null, education: 'B.E. Computer Science, K S School of Engineering',
    top_skills: ['Python', 'FastAPI'], signals: { email: true, phone: true, linkedin: false, github: true },
    notes: [{ kind: 'good', text: 'Your name is clear at the top.' }, { kind: 'warn', text: 'No LinkedIn link.' }],
  }
  it('shows what was found and labels what was not', () => {
    render(<ScanCard scan={scan} />)
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.getByText('Not obvious')).toBeInTheDocument()                      // latest role is missing
    expect(screen.getByText('FastAPI')).toBeInTheDocument()
    expect(screen.getAllByLabelText('missing')).toHaveLength(1)                       // only LinkedIn
    expect(screen.getAllByLabelText('present')).toHaveLength(3)
    expect(screen.getByText('No LinkedIn link.')).toBeInTheDocument()
  })
})

describe('ResumeViewer', () => {
  it('marks quoted evidence in the resume text', () => {
    const { container } = render(<ResumeViewer text={'Built APIs. Cut latency by 35% for users.'} marks={[{ id: 's0', quote: 'Cut latency by 35%', kind: 'good' }]} />)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('Cut latency by 35%')
  })
  it('scrolls to the active quote', () => {
    render(<ResumeViewer text="Built APIs. Cut latency by 35% for users." marks={[{ id: 's0', quote: 'Cut latency by 35%', kind: 'good' }]} activeId="s0" />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})

describe('ScoreRing', () => {
  it('shows a dash when there is no score yet, never a fake number', () => {
    render(<ScoreRing score={null} label="ATS score" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('RewritePanel', () => {
  it('asks the server, shows before/after, and reports discarded suggestions', async () => {
    post.mockResolvedValue({ data: { considered: 3, skipped: 1, rewrites: [{ original: 'Worked on the backend.', rewritten: 'Developed backend features, cutting load time by [X%].', why: 'Active verb, room for a result.' }] } })
    render(<RewritePanel resumeId="r1" initial={null} />)
    await userEvent.click(screen.getByRole('button', { name: /rewrite bullets/i }))
    expect(post).toHaveBeenCalledWith('/resumes/r1/rewrite')
    expect(await screen.findByText('Worked on the backend.')).toBeInTheDocument()
    expect(screen.getByText(/cutting load time by \[X%\]/)).toBeInTheDocument()
    expect(screen.getByText(/1 suggestion was discarded because it added numbers/)).toBeInTheDocument()
  })
  it('re-requests with force when trying again', async () => {
    post.mockResolvedValue({ data: { considered: 0, skipped: 0, rewrites: [] } })
    render(<RewritePanel resumeId="r1" initial={{ considered: 2, skipped: 0, rewrites: [] }} />)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/resumes/r1/rewrite?force=true'))
  })
  it('says so when there is nothing weak to rewrite', () => {
    render(<RewritePanel resumeId="r1" initial={{ considered: 0, skipped: 0, rewrites: [] }} />)
    expect(screen.getByText(/nothing to rewrite/i)).toBeInTheDocument()
  })
})
