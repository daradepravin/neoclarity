import { useEffect, useState } from 'react'
import { dashboardApi, accountsApi, recommendationsApi, lifeEventsApi, goalsApi, ResilienceScore, Account, Recommendation, LifeEvent, Goal } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }
function scoreColor(s: number) { return s >= 75 ? '#1F8A5A' : s >= 50 ? '#C77700' : '#C0392B' }
function scoreLabel(s: number) { return s >= 75 ? 'Strong' : s >= 50 ? 'Moderate' : 'At Risk' }

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export default function Dashboard() {
  const { customer } = useAuth()
  const [score, setScore] = useState<ResilienceScore | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ResilienceScore[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [nba, setNba] = useState<Recommendation | null>(null)
  const [nbaState, setNbaState] = useState<'idle' | 'approved' | 'dismissed'>('idle')
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.getResilienceScore(),
      dashboardApi.getScoreHistory(),
      accountsApi.getAll(),
      recommendationsApi.getNextBestAction().catch(() => ({ data: null })),
      lifeEventsApi.getAll().catch(() => ({ data: [] })),
      goalsApi.getAll().catch(() => ({ data: [] })),
    ]).then(([s, hist, accs, n, ev, gl]) => {
      setScore(s.data); setScoreHistory(hist.data); setAccounts(accs.data)
      setNba((n as any).data); setEvents((ev as any).data); setGoals((gl as any).data)
    }).finally(() => setLoading(false))
  }, [])

  const handleNba = async (action: 'APPROVED' | 'DISMISSED') => {
    if (!nba) return
    try { await recommendationsApi.respond(nba.recommendationId, action) } catch {}
    setNbaState(action === 'APPROVED' ? 'approved' : 'dismissed')
  }

  if (loading) return <Spinner />

  const firstName = customer?.firstName || 'there'
  const trend = scoreHistory.length >= 2 ? scoreHistory[0].overall - scoreHistory[scoreHistory.length - 1].overall : null
  const pendingEvents = events.filter(e => !e.confirmed)
  const activeGoals = goals.filter(g => g.status === 'ACTIVE')

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#12867F', letterSpacing: '0.02em', marginBottom: 5 }}>{today}</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: '#14181F' }}>
            Here's your move this week, {firstName}.
          </h1>
        </div>
        {score && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E3E6EA', borderRadius: 8, padding: '9px 13px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreColor(score.overall) }}></div>
            <span style={{ fontSize: 13, color: '#6B7682' }}>Resilience</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#14181F' }}>{score.overall}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(score.overall) }}>{scoreLabel(score.overall)}</span>
          </div>
        )}
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.85fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* NBA HERO CARD */}
          {nba && nbaState === 'idle' && (
            <div style={{ background: 'linear-gradient(155deg,#13283F 0%,#0E1C2E 60%)', borderRadius: 14, padding: 26, color: '#fff', boxShadow: '0 18px 40px -16px rgba(14,28,46,.5)', position: 'relative', overflow: 'hidden', animation: 'ncPop 0.2s ease' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(18,163,155,.16)', border: '1px solid rgba(18,163,155,.4)', padding: '5px 11px', borderRadius: 20 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1FCab8' }}></div>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#7FE0D6' }}>NEXT BEST ACTION · #1 PRIORITY</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 12, color: '#9DB0C4' }}>Confidence</span>
                  <div style={{ width: 64, height: 6, background: 'rgba(255,255,255,.14)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: '#1FCab8', width: `${Math.round(nba.confidence * 100)}%` }}></div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{Math.round(nba.confidence * 100)}%</span>
                </div>
              </div>

              {/* Category + effort */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1FCab8', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>BUILD RESILIENCE</span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#4A5E73', display: 'block' }}></span>
                <span style={{ fontSize: 12, color: '#9DB0C4' }}>Low effort</span>
              </div>

              {/* Title */}
              <h2 style={{ margin: '0 0 12px', fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.18, maxWidth: 600 }}>
                {nba.recommendationText}
              </h2>
              <p style={{ margin: '0 0 18px', fontSize: 14.5, lineHeight: 1.6, color: '#B9C7D6', maxWidth: 620 }}>{nba.reason}</p>

              {/* Evidence bullets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {[nba.reason, nba.expectedImpact].filter(Boolean).map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginTop: 2, flexShrink: 0 }}><circle cx="8" cy="8" r="7" fill="rgba(18,163,155,.18)"/><path d="m5 8 2 2 4-4.5" stroke="#1FCab8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize: 13, color: '#CBD6E2', lineHeight: 1.4 }}>{e}</span>
                  </div>
                ))}
              </div>

              {/* Impact bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'rgba(18,163,155,.1)', border: '1px solid rgba(18,163,155,.28)', borderRadius: 10, padding: '13px 16px', marginBottom: 22 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M3 13l4-4 3 3 6-6.5" stroke="#1FCab8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 5.5h4v4" stroke="#1FCab8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{nba.expectedImpact}</div>
                  <div style={{ fontSize: 12.5, color: '#9DB0C4', marginTop: 1 }}>Estimated outcome if you approve</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                <button onClick={() => handleNba('APPROVED')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#12A39B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '11px 22px', borderRadius: 8, boxShadow: '0 4px 14px -4px rgba(18,163,155,.7)' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m3 8 3.2 3.2L13 4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Approve
                </button>
                <button style={{ fontSize: 14, fontWeight: 600, color: '#CBD6E2', padding: '11px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,.16)' }}>Remind me later</button>
                <button onClick={() => handleNba('DISMISSED')} style={{ fontSize: 14, fontWeight: 600, color: '#8597A9', padding: '11px 14px', borderRadius: 8 }}>Dismiss</button>
              </div>

              {/* HITL notice */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, paddingTop: 15, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="#6F8197" strokeWidth="1.2"/><path d="M4.5 6V4.3a2.5 2.5 0 0 1 5 0V6" stroke="#6F8197" strokeWidth="1.2"/></svg>
                <span style={{ fontSize: 12, color: '#6F8197' }}>Nothing happens automatically. NeoClarity recommends — <span style={{ color: '#9DB0C4', fontWeight: 600 }}>you decide.</span></span>
              </div>
            </div>
          )}

          {nbaState === 'approved' && (
            <div style={{ background: 'linear-gradient(155deg,#0A2E1E,#0B3828)', borderRadius: 14, padding: 26, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(31,202,184,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✅</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Action approved — Twin updating</div>
                  <div style={{ fontSize: 13, color: '#9DB0C4', marginTop: 3 }}>Goal contribution increase recorded. Clarity Score will refresh shortly.</div>
                </div>
              </div>
            </div>
          )}

          {(!nba || nbaState === 'dismissed') && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E3E6EA', padding: 26, textAlign: 'center', color: '#9AA3AD' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#3D454E' }}>You're on track</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No pending actions right now — check back later.</div>
            </div>
          )}

          {/* RECENT EVENTS */}
          {pendingEvents.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#14181F' }}>Events awaiting confirmation</div>
                <span style={{ background: '#12A39B', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{pendingEvents.length}</span>
              </div>
              {pendingEvents.slice(0, 2).map(e => (
                <div key={e.eventId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #EEF0F3' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14181F' }}>✈️ {e.label}</div>
                    <div style={{ fontSize: 12, color: '#8A929C', marginTop: 2 }}>{Math.round(e.detectionConfidence * 100)}% confident · {e.transactionCount} transactions</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#C77700' }}>{fmt(e.totalCost)}</div>
                    <div style={{ fontSize: 11, color: '#8A929C' }}>detected cost</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GOAL SUMMARY */}
          {activeGoals.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#14181F', marginBottom: 14 }}>Active Goals</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeGoals.slice(0, 3).map(g => {
                  const icons: Record<string, string> = { EMERGENCY_FUND: '🛡️', VACATION: '✈️', COLLEGE: '🎓', DEBT_PAYOFF: '💳' }
                  const labels: Record<string, string> = { EMERGENCY_FUND: 'Emergency Fund', VACATION: 'Vacation Fund', COLLEGE: 'College Fund', DEBT_PAYOFF: 'Debt Payoff' }
                  return (
                    <div key={g.goalId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#3D454E' }}>{icons[g.goalType] || '🎯'} {labels[g.goalType] || g.goalType}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#12867F' }}>{g.progressPercent}%</span>
                      </div>
                      <div style={{ background: '#EEF0F3', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${g.progressPercent}%`, height: '100%', background: '#12A39B', borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — score + accounts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {score && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>Clarity Score</div>

              {/* Ring */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <NeoRing score={score.overall} />
              </div>

              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(score.overall) }}>{scoreLabel(score.overall)} Resilience</span>
                {trend !== null && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: trend >= 0 ? '#E7F3EC' : '#FBE9E7', borderRadius: 99, padding: '3px 10px', marginLeft: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: trend >= 0 ? '#1F8A5A' : '#C0392B' }}>
                      {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} pts
                    </span>
                  </div>
                )}
              </div>

              {/* Component bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {([
                  ['Emergency Fund', score.components.emergencyFund],
                  ['Cash Flow', score.components.cashFlow],
                  ['Debt Burden', score.components.debtBurden],
                  ['Income Stability', score.components.incomeStability],
                  ['Goal Readiness', score.components.goalReadiness],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11.5, color: '#6B7682' }}>{label}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: scoreColor(val) }}>{val}</span>
                    </div>
                    <div style={{ background: '#EEF0F3', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>Linked Accounts</div>
            {accounts.map(a => {
              const icon = a.accountType === 'CHECKING' ? '🏦' : a.accountType === 'SAVINGS' ? '💰' : '💳'
              const isNeg = a.balance < 0
              return (
                <div key={a.accountId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #EEF0F3' }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#14181F' }}>{a.institution} {a.accountType}</div>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: isNeg ? '#C0392B' : '#1F8A5A' }}>{fmt(a.balance)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function NeoRing({ score }: { score: number }) {
  const size = 120, stroke = 12, r = (size - stroke) / 2
  const circ = 2 * Math.PI * r, offset = circ - (score / 100) * circ
  const color = score >= 75 ? '#1F8A5A' : score >= 50 ? '#C77700' : '#C0392B'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2-5} textAnchor="middle" fontSize={size*0.22} fontWeight={700} fill="#14181F">{score}</text>
      <text x={size/2} y={size/2+13} textAnchor="middle" fontSize={size*0.1} fill="#9AA3AD">/ 100</text>
    </svg>
  )
}
