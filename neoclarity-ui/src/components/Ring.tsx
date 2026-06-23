function scoreColor(s: number) { return s >= 75 ? '#0F6E56' : s >= 50 ? '#92400E' : '#991B1B' }
export default function Ring({ score, size = 110 }: { score: number; size?: number }) {
  const stroke = size * 0.1; const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ
  const color = scoreColor(score)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 - 6} textAnchor="middle" fontSize={size*0.22} fontWeight={700} fill="#1E293B">{score}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fontSize={size*0.1} fill="#94A3B8">/ 100</text>
    </svg>
  )
}
