export default function ProgressBar({ value, max, color = '#1A6EBD' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  )
}
