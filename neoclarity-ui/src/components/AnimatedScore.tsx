import { useEffect, useRef, useState } from 'react'

interface Props {
  score: number
  previousScore?: number
  size?: number
}

function scoreColor(s: number) { return s >= 75 ? '#1F8A5A' : s >= 50 ? '#C77700' : '#C0392B' }
function scoreLabel(s: number) { return s >= 75 ? 'Strong' : s >= 50 ? 'Moderate' : 'At Risk' }

export default function AnimatedScore({ score, previousScore, size = 130 }: Props) {
  const [displayed, setDisplayed] = useState(previousScore ?? score)
  const [animating, setAnimating] = useState(false)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (previousScore === undefined || previousScore === score) {
      setDisplayed(score)
      return
    }

    // Animate number counting up or down
    setAnimating(true)
    const start = previousScore
    const end = score
    const duration = 1200
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayed(end)
        setAnimating(false)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [score, previousScore])

  const stroke = size * 0.1
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (displayed / 100) * circ
  const color = scoreColor(displayed)
  const delta = previousScore !== undefined ? score - previousScore : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: animating ? 'none' : 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1), stroke .4s' }} />
          <text x={size/2} y={size/2 - 6} textAnchor="middle" fontSize={size * 0.22} fontWeight={700} fill="#14181F">{displayed}</text>
          <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize={size * 0.1} fill="#9AA3AD">/ 100</text>
        </svg>

        {/* Delta badge — only shows when score moved */}
        {delta !== 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            background: delta > 0 ? '#E7F3EC' : '#FBE9E7',
            color: delta > 0 ? '#1F8A5A' : '#C0392B',
            fontSize: 11, fontWeight: 800, padding: '3px 7px', borderRadius: 99,
            border: `1.5px solid ${delta > 0 ? '#1F8A5A' : '#C0392B'}`,
            animation: 'ncFade 0.3s ease',
          }}>
            {delta > 0 ? '+' : ''}{delta}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{scoreLabel(displayed)} Resilience</div>
        {delta !== 0 && (
          <div style={{ fontSize: 12, color: '#8A929C', marginTop: 2 }}>
            {delta > 0 ? '↑ improved' : '↓ declined'} from {previousScore}
          </div>
        )}
      </div>
    </div>
  )
}
