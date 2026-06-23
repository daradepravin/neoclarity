import { useEffect, useState } from 'react'
import { goalsApi, Goal } from '../api/client'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import Btn from '../components/Btn'
import Spinner from '../components/Spinner'

const GOAL_ICONS: Record<string, string> = { EMERGENCY_FUND: '🛡️', VACATION: '✈️', COLLEGE: '🎓', DEBT_PAYOFF: '💳' }
const GOAL_LABELS: Record<string, string> = { EMERGENCY_FUND: 'Emergency Fund', VACATION: 'Vacation Fund', COLLEGE: 'College Fund', DEBT_PAYOFF: 'Debt Payoff' }
function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newGoal, setNewGoal] = useState({ goalType: 'EMERGENCY_FUND', targetAmount: '', monthlyContribution: '' })

  useEffect(() => {
    goalsApi.getAll().then(r => setGoals(r.data)).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    try {
      const res = await goalsApi.create({ goalType: newGoal.goalType, targetAmount: parseFloat(newGoal.targetAmount), monthlyContribution: parseFloat(newGoal.monthlyContribution || '0') } as any)
      setGoals(g => [...g, res.data])
      setShowNew(false)
      setNewGoal({ goalType: 'EMERGENCY_FUND', targetAmount: '', monthlyContribution: '' })
    } catch {}
  }

  const handlePause = async (g: Goal) => {
    const fn = g.status === 'ACTIVE' ? goalsApi.pause : goalsApi.resume
    const res = await fn(g.goalId)
    setGoals(gs => gs.map(x => x.goalId === g.goalId ? res.data : x))
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#14181F' }}>My Goals</div>
        <Btn label="+ Add Goal" variant="secondary" small onClick={() => setShowNew(true)} />
      </div>

      {showNew && (
        <Card style={{ border: '2px solid #1A6EBD' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0A2342', marginBottom: 14 }}>New Goal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6470', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={newGoal.goalType} onChange={e => setNewGoal(g => ({ ...g, goalType: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 13 }}>
                <option value="EMERGENCY_FUND">Emergency Fund</option>
                <option value="VACATION">Vacation</option>
                <option value="COLLEGE">College</option>
                <option value="DEBT_PAYOFF">Debt Payoff</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6470', display: 'block', marginBottom: 4 }}>Target ($)</label>
              <input type="number" value={newGoal.targetAmount} onChange={e => setNewGoal(g => ({ ...g, targetAmount: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#5A6470', display: 'block', marginBottom: 4 }}>Monthly ($)</label>
              <input type="number" value={newGoal.monthlyContribution} onChange={e => setNewGoal(g => ({ ...g, monthlyContribution: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn label="Create Goal" variant="success" onClick={handleCreate} />
            <Btn label="Cancel" variant="ghost" onClick={() => setShowNew(false)} />
          </div>
        </Card>
      )}

      {goals.map(g => (
        <Card key={g.goalId}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{GOAL_ICONS[g.goalType] || '🎯'}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#14181F' }}>{GOAL_LABELS[g.goalType] || g.goalType}</div>
                <div style={{ fontSize: 12, color: '#9AA3AD' }}>Contributing {fmt(g.monthlyContribution)}/month</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#12A39B' }}>{g.progressPercent}%</div>
              <div style={{ fontSize: 11, color: '#9AA3AD' }}>complete</div>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <ProgressBar value={g.currentAmount} max={g.targetAmount} color="#1A6EBD" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: '#6B7682' }}>
            <span>{fmt(g.currentAmount)} saved</span>
            <span>Target: {fmt(g.targetAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {g.deadline && (
              <div style={{ background: '#E8F1FB', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#12A39B' }}>
                📅 Deadline: {new Date(g.deadline).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <Btn label={g.status === 'ACTIVE' ? 'Pause' : 'Resume'} variant="ghost" small onClick={() => handlePause(g)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
