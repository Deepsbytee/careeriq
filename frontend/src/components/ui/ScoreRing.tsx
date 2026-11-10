import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface ScoreRingProps {
  score: number | null
  label: string
  size?: number
  animated?: boolean
  className?: string
}

export function ScoreRing({ score, label, size = 100, animated = true, className }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const targetFill = score != null ? (score / 100) * circ : 0

  useEffect(() => {
    if (!animated || score == null) {
      setDisplayScore(score ?? 0)
      return
    }
    let start = 0
    const duration = 1200
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayScore(Math.round(score * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => { start = 0 }
  }, [score, animated])

  const fill = score != null ? (displayScore / 100) * circ : 0
  const color =
    score == null
      ? '#6F6563'
      : score >= 75
        ? '#4F7A2E'
        : score >= 50
          ? '#A86A0C'
          : '#C2294A'

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(42,26,30,0.08)"
            strokeWidth={8}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ - fill}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={false}
            animate={{ strokeDasharray: `${targetFill} ${circ - targetFill}` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-bold"
          style={{ fontSize: size * 0.22, color }}
        >
          {score != null ? displayScore : '—'}
        </div>
      </div>
      <span className="text-xs text-slate-400 text-center leading-snug">{label}</span>
    </div>
  )
}
