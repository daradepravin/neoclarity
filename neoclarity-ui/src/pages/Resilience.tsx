import { useEffect, useState } from 'react'
import { dashboardApi, ResilienceScore } from '../api/client'
import Spinner from '../components/Spinner'

function scoreColor(s: number) { return s >= 75 ? '#1F8A5A' : s >= 50 ? '#C77700' : '#C0392B' }

export default function Resilience() {
  const [scores, setScores] = useState<ResilienceScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.getScoreHistory().then(r => setScores(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  const latest = scores[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#14181F', margin: '0 0 4px' }}>Financial Resilience</h1>
        <p style={{ fontSize: 13.5, color: '#6B7682', margin: 0 }}>Your Clarity Score across all five resilience dimensions</p>
      </div>

      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
          {([
            ['Emergency Fund', latest.components.emergencyFund, '🛡️', 'Months of expenses covered'],
            ['Cash Flow', latest.components.cashFlow, '💵', 'Income vs expense stability'],
            ['Debt Burden', latest.components.debtBurden, '💳', 'Debt-to-income ratio'],
            ['Income Stability', latest.components.incomeStability, '📈', 'Income consistency'],
            ['Goal Readiness', latest.components.goalReadiness, '🎯', 'Progress toward goals'],
          ] as [string, number, string, string][]).map(([label, val, icon, desc]) => (
            <div key={label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '18px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 20 }}>{icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor(val) }}>{val}</div>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#14181F', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#8A929C', marginBottom: 10 }}>{desc}</div>
              <div style={{ background: '#EEF0F3', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 99 }} />
              </div>
            </div>
          ))}
          <div style={{ background: 'linear-gradient(135deg,#0E1C2E,#13283F)', borderRadius: 12, padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#fff' }}>{latest.overall}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1FCab8', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Overall</div>
            <div style={{ fontSize: 12, color: '#9DB0C4', marginTop: 2 }}>Clarity Score</div>
          </div>
        </div>
      )}

      {scores.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#14181F', marginBottom: 14 }}>Score History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scores.map((s, i) => (
              <div key={s.computedAt} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: i < scores.length - 1 ? '1px solid #EEF0F3' : 'none' }}>
                <div style={{ fontSize: 12, color: '#8A929C', minWidth: 120 }}>{new Date(s.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div style={{ flex: 1, background: '#EEF0F3', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${s.overall}%`, height: '100%', background: scoreColor(s.overall), borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor(s.overall), minWidth: 36, textAlign: 'right' as const }}>{s.overall}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
