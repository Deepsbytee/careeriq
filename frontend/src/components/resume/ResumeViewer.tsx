import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../../lib/utils'

export interface Mark {
  id: string
  quote: string
  kind: 'good' | 'warn'
}

interface Segment {
  text: string
  mark?: Mark
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Split `text` into plain and highlighted segments. Quotes match across line breaks and bullet glyphs. */
export function segmentText(text: string, marks: Mark[]): Segment[] {
  const found: { start: number; end: number; mark: Mark }[] = []
  for (const mark of marks) {
    const words = mark.quote.trim().split(/\s+/).filter(Boolean)
    if (words.length < 2) continue
    const rx = new RegExp(words.map(esc).join('[\\s•●▪◦\\-–]+'), 'i')
    const m = rx.exec(text)
    if (m) found.push({ start: m.index, end: m.index + m[0].length, mark })
  }
  found.sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let pos = 0
  for (const f of found) {
    if (f.start < pos) continue // overlaps an earlier highlight
    if (f.start > pos) out.push({ text: text.slice(pos, f.start) })
    out.push({ text: text.slice(f.start, f.end), mark: f.mark })
    pos = f.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

interface Props {
  text: string
  marks: Mark[]
  activeId?: string | null
}

export function ResumeViewer({ text, marks, activeId }: Props) {
  const segments = useMemo(() => segmentText(text, marks), [text, marks])
  const refs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    if (activeId && refs.current[activeId]) {
      refs.current[activeId]!.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeId])

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-slate-300 max-h-[28rem] overflow-y-auto rounded-xl bg-surface-2 border border-border p-5">
      {segments.map((s, i) =>
        s.mark ? (
          <mark
            key={i}
            ref={el => { refs.current[s.mark!.id] = el }}
            className={cn(
              'rounded px-0.5 text-slate-100 transition-shadow',
              s.mark.kind === 'good' ? 'bg-emerald-500/20 border-b-2 border-emerald-500' : 'bg-blossom border-b-2 border-red-500',
              activeId === s.mark.id && 'ring-2 ring-indigo-500/50'
            )}
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </pre>
  )
}
