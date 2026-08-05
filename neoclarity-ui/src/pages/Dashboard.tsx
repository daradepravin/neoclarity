import { useEffect, useRef, useState, useCallback } from 'react'
import { dashboardApi, accountsApi, recommendationsApi, lifeEventsApi, goalsApi,
         syncApi, ResilienceScore, Account, Recommendation, LifeEvent, Goal, SyncResult } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import SyncButton from '../components/SyncButton'
import AnimatedScore from '../components/AnimatedScore'
import ConsequenceIndicator from '../components/ConsequenceIndicator'

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }
function scoreColor(s: number) { return s >= 75 ? '#1F8A5A' : s >= 50 ? '#C77700' : '#C0392B' }

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export default function Dashboard() {
  const { customer } = useAuth()
  const [score, setScore] = useState<ResilienceScore | null>(null)
  const [previousScore, setPreviousScore] = useState<ResilienceScore | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [netWorth, setNetWorth] = useState<number | null>(null)
  const [nba, setNba] = useState<Recommendation | null>(null)
  const [nbaState, setNbaState] = useState<'idle' | 'approved' | 'dismissed'>('idle')
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [polling, setPolling] = useState(false)
  const pollActive = useRef(false)

  useEffect(() => { return () => { pollActive.current = false } }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const [s, accs, nw, n, ev, gl, status] = await Promise.all([
        dashboardApi.getResilienceScore().catch(() => ({ data: null })),
        accountsApi.getAll().catch(() => ({ data: [] })),
        accountsApi.getNetWorth().catch(() => ({ data: { netWorth: 0, accountCount: 0 } })),
        recommendationsApi.getNextBestAction().catch(() => ({ data: null })),
        lifeEventsApi.getAll().catch(() => ({ data: [] })),
        goalsApi.getAll().catch(() => ({ data: [] })),
        syncApi.status().catch(() => ({ data: { currentBatch: 0, totalBatches: 3, hasMore: true } })),
      ])
      setScore(s.data as ResilienceScore | null)
      setAccounts((accs as any).data)
      setNetWorth((nw as any).data?.netWorth ?? null)
      setNba((n as any).data)
      setEvents((ev as any).data)
      setGoals((gl as any).data)
      setCurrentBatch((status as any).data?.currentBatch ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // After sync, poll for new score for up to 15s (agent runs async)
  const pollForNewScore = useCallback(async (prevScore: ResilienceScore | null) => {
    setPolling(true)
    pollActive.current = true
    let attempts = 0
    const maxAttempts = 10

    const poll = async () => {
      if (!pollActive.current || attempts >= maxAttempts) { setPolling(false); return }
      attempts++
      try {
        const res = await dashboardApi.getResilienceScore()
        if (!pollActive.current) return
        const newScore = res.data
        if (newScore && (!prevScore || newScore.computedAt !== prevScore?.computedAt)) {
          setPreviousScore(prevScore)
          setScore(newScore)
          recommendationsApi.getNextBestAction().then(r => setNba((r as any).data)).catch(() => {})
          goalsApi.getAll().then(r => setGoals((r as any).data)).catch(() => {})
          setPolling(false)
          setCurrentBatch(b => b + 1)
          pollActive.current = false
          return
        }
        setTimeout(poll, 1500)
      } catch {
        if (pollActive.current) setTimeout(poll, 1500)
      }
    }
    setTimeout(poll, 2000) // give agent time to start
  }, [])

  const handleSync = async (result: SyncResult) => {
    setSyncResult(result)
    setNbaState('idle')
    const prev = score
    await pollForNewScore(prev)
  }

  const handleNba = async (action: 'APPROVED' | 'DISMISSED') => {
    if (!nba) return
    try { await recommendationsApi.respond(nba.recommendationId, action) } catch {}
    setNbaState(action === 'APPROVED' ? 'approved' : 'dismissed')
  }

  if (loading) return <Spinner />

  const firstName = customer?.firstName || 'there'
  const pendingEvents = events.filter(e => !e.confirmed)
  const activeGoals = goals.filter(g => g.status === 'ACTIVE')

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#12867F', letterSpacing: '0.02em', marginBottom: 5 }}>{today}</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: '#14181F' }}>
            Here's your move this week, {firstName}.
          </h1>
          {polling && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, fontSize: 12.5, color: '#12867F' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#12A39B', animation: 'pulse 1s infinite' }} />
              Agents analysing new transactions…
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {score && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E3E6EA', borderRadius: 8, padding: '9px 13px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: scoreColor(score.overall) }} />
              <span style={{ fontSize: 13, color: '#6B7682' }}>Clarity Score</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#14181F' }}>{score.overall}</span>
            </div>
          )}
          <SyncButton
            onSyncComplete={handleSync}
            currentBatch={currentBatch}
            totalBatches={3}
          />
        </div>
      </div>

      {/* CONSEQUENCE INDICATOR — appears after sync */}
      {syncResult && (
        <div style={{ marginBottom: 18 }}>
          <ConsequenceIndicator
            currentScore={score}
            previousScore={previousScore}
            syncResult={syncResult}
          />
        </div>
      )}

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.85fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* NBA HERO CARD */}
          {nba && nbaState === 'idle' && (
            <div style={{ background: 'linear-gradient(155deg,#13283F 0%,#0E1C2E 60%)', borderRadius: 14, padding: 26, color: '#fff', boxShadow: '0 18px 40px -16px rgba(14,28,46,.5)', position: 'relative', overflow: 'hidden', animation: 'ncPop 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(18,163,155,.16)', border: '1px solid rgba(18,163,155,.4)', padding: '5px 11px', borderRadius: 20 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1FCab8' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#7FE0D6' }}>NEXT BEST ACTION · #1 PRIORITY</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 12, color: '#9DB0C4' }}>Confidence</span>
                  <div style={{ width: 64, height: 6, background: 'rgba(255,255,255,.14)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: '#1FCab8', width: `${Math.round(nba.confidence * 100)}%` }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{Math.round(nba.confidence * 100)}%</span>
                </div>
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {nba.recommendationText}
              </h2>
              <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: '#B9C7D6' }}>{nba.reason}</p>
              <div style={{ background: 'rgba(18,163,155,.1)', border: '1px solid rgba(18,163,155,.28)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{nba.expectedImpact}</div>
                <div style={{ fontSize: 12, color: '#9DB0C4', marginTop: 2 }}>Estimated outcome if you approve</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => handleNba('APPROVED')} style={{ background: '#12A39B', color: '#fff', fontSize: 14, fontWeight: 700, padding: '11px 22px', borderRadius: 8, border: 'none', boxShadow: '0 4px 14px -4px rgba(18,163,155,.7)' }}>
                  ✓ Approve
                </button>
                <button style={{ fontSize: 14, fontWeight: 600, color: '#CBD6E2', padding: '11px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,.16)', background: 'transparent' }}>Remind me later</button>
                <button onClick={() => handleNba('DISMISSED')} style={{ fontSize: 14, fontWeight: 600, color: '#8597A9', padding: '11px 14px', borderRadius: 8, background: 'transparent', border: 'none' }}>Dismiss</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: '#6F8197' }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" stroke="#6F8197" strokeWidth="1.2"/><path d="M4.5 6V4.3a2.5 2.5 0 0 1 5 0V6" stroke="#6F8197" strokeWidth="1.2"/></svg>
                NeoClarity recommends — <span style={{ color: '#9DB0C4', fontWeight: 600 }}>you decide.</span>
              </div>
            </div>
          )}

          {nbaState === 'approved' && (
            <div style={{ background: 'linear-gradient(155deg,#0A2E1E,#0B3828)', borderRadius: 14, padding: 26, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Action approved — Twin updating</div>
                  <div style={{ fontSize: 13, color: '#9DB0C4', marginTop: 3 }}>Decision recorded. Clarity Score will reflect this on next sync.</div>
                </div>
              </div>
            </div>
          )}

          {(!nba || nbaState === 'dismissed') && !syncResult && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E3E6EA', padding: 26, textAlign: 'center', color: '#9AA3AD' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#3D454E' }}>You're on track</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Sync accounts to run a fresh analysis.</div>
            </div>
          )}

          {/* PENDING EVENTS */}
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GOALS */}
          {activeGoals.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#14181F', marginBottom: 14 }}>Active Goals</div>
              {activeGoals.slice(0, 3).map(g => {
                const icons: Record<string, string> = { EMERGENCY_FUND: '🛡️', VACATION: '✈️', COLLEGE: '🎓', DEBT_PAYOFF: '💳' }
                const labels: Record<string, string> = { EMERGENCY_FUND: 'Emergency Fund', VACATION: 'Vacation Fund', COLLEGE: 'College Fund', DEBT_PAYOFF: 'Debt Payoff' }
                return (
                  <div key={g.goalId} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#3D454E' }}>{icons[g.goalType] || '🎯'} {labels[g.goalType] || g.goalType}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#12867F' }}>{g.progressPercent}%</span>
                    </div>
                    <div style={{ background: '#EEF0F3', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${g.progressPercent}%`, height: '100%', background: '#12A39B', borderRadius: 99, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — animated score + accounts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {score && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Clarity Score</div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <AnimatedScore
                  score={score.overall}
                  previousScore={previousScore?.overall}
                  size={130}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {([
                  ['Emergency Fund', score.components.emergencyFund],
                  ['Cash Flow', score.components.cashFlow],
                  ['Debt Burden', score.components.debtBurden],
                  ['Income Stability', score.components.incomeStability],
                  ['Goal Readiness', score.components.goalReadiness],
                ] as [string, number][]).map(([label, val]) => {
                  const prevVal = previousScore?.components[
                    label === 'Emergency Fund' ? 'emergencyFund' :
                    label === 'Cash Flow' ? 'cashFlow' :
                    label === 'Debt Burden' ? 'debtBurden' :
                    label === 'Income Stability' ? 'incomeStability' : 'goalReadiness'
                  ]
                  const changed = prevVal !== undefined && val !== prevVal
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11.5, color: '#6B7682' }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {changed && prevVal !== undefined && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: val > prevVal ? '#1F8A5A' : '#C0392B' }}>
                              {val > prevVal ? '↑' : '↓'}{Math.abs(val - prevVal)}
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: scoreColor(val) }}>{val}</span>
                        </div>
                      </div>
                      <div style={{ background: '#EEF0F3', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${val}%`, height: '100%', background: scoreColor(val), borderRadius: 99, transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Accounts */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E3E6EA', padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9AA3AD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Linked Accounts</div>
            {accounts.filter(a => a.active).map(a => {
              const icon = a.accountType === 'CHECKING' ? '🏦' : a.accountType === 'SAVINGS' ? '💰' : '💳'
              return (
                <div key={a.accountId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #EEF0F3' }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#14181F' }}>{a.institution} {a.accountType}</div>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: a.balance < 0 ? '#C0392B' : '#1F8A5A' }}>{fmt(a.balance)}</div>
                </div>
              )
            })}
            {netWorth !== null && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E3E6EA', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6B7682' }}>Net worth</span>
                <span style={{ fontWeight: 700, color: '#14181F' }}>{fmt(netWorth)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
