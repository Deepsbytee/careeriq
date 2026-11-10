import { describe, expect, it } from 'vitest'
import { errorMessage, scoreTone } from '../lib/api'
import { segmentText, type Mark } from '../components/resume/ResumeViewer'

describe('errorMessage', () => {
  it('shows the server\'s own explanation', () => {
    const err = { response: { data: { detail: 'This looks like an invoice.', code: 'NOT_A_RESUME' } } }
    expect(errorMessage(err, 'fallback')).toBe('This looks like an invoice.')
  })
  it('ignores non-string details such as validation arrays', () => {
    expect(errorMessage({ response: { data: { detail: [{ msg: 'x' }] } } }, 'fallback')).toBe('fallback')
  })
  it('says the server is unreachable when there was no response', () => {
    expect(errorMessage(new Error('Network Error'), 'fallback')).toMatch(/can't reach the server/i)
  })
  it('falls back for an empty detail', () => {
    expect(errorMessage({ response: { data: { detail: '   ' } } }, 'fallback')).toBe('fallback')
  })
})

describe('scoreTone', () => {
  it('buckets scores', () => {
    expect([scoreTone(90), scoreTone(75), scoreTone(60), scoreTone(10), scoreTone(null), scoreTone(undefined)])
      .toEqual(['good', 'good', 'mid', 'low', 'none', 'none'])
  })
})

describe('segmentText (evidence highlighting)', () => {
  const text = 'EXPERIENCE\n• Built 6 REST API endpoints with FastAPI\n  and PostgreSQL, cutting response time by 35%.\n• Wrote 25 unit tests.'
  const m = (id: string, quote: string, kind: Mark['kind'] = 'good'): Mark => ({ id, quote, kind })

  it('highlights a quote and keeps all other text untouched', () => {
    const segs = segmentText(text, [m('a', 'Wrote 25 unit tests')])
    expect(segs.map(s => s.text).join('')).toBe(text)
    expect(segs.filter(s => s.mark).map(s => s.text)).toEqual(['Wrote 25 unit tests'])
  })
  it('matches quotes that wrap across a line break', () => {
    const segs = segmentText(text, [m('a', 'FastAPI and PostgreSQL, cutting response time by 35%')])
    expect(segs.filter(s => s.mark)).toHaveLength(1)
    expect(segs.filter(s => s.mark)[0].text).toContain('FastAPI\n  and PostgreSQL')
  })
  it('is case-insensitive', () => {
    expect(segmentText(text, [m('a', 'WROTE 25 UNIT TESTS')]).some(s => s.mark)).toBe(true)
  })
  it('skips quotes that are not in the text rather than guessing', () => {
    const segs = segmentText(text, [m('a', 'Won the Nobel Prize in Physics')])
    expect(segs).toEqual([{ text }])
  })
  it('ignores one-word quotes (too ambiguous to highlight)', () => {
    expect(segmentText(text, [m('a', 'Built')]).some(s => s.mark)).toBe(false)
  })
  it('never highlights overlapping quotes twice', () => {
    const segs = segmentText(text, [m('a', 'Built 6 REST API endpoints'), m('b', 'REST API endpoints with FastAPI')])
    expect(segs.map(s => s.text).join('')).toBe(text)
    expect(segs.filter(s => s.mark)).toHaveLength(1)
  })
  it('escapes regex characters in quotes', () => {
    const t = 'Raised coverage to 82% (from 40%) using pytest [CI].'
    expect(segmentText(t, [m('a', 'coverage to 82% (from 40%)')]).some(s => s.mark)).toBe(true)
  })
  it('handles empty input', () => {
    expect(segmentText('', [m('a', 'anything at all')])).toEqual([])
    expect(segmentText('hello world', [])).toEqual([{ text: 'hello world' }])
  })
})
